"""Reproduce the supplied engine and prepare traceable research imports. No database writes."""
import argparse
import collections
import csv
import datetime
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
from urllib.parse import urlsplit
import zipfile

FILES = {
    'broker': ('BTS_Brokers_Researched.csv', 'bts_scores_brokers.csv', 1013),
    'propfirm': ('BTS_Prop_Firms_Researched.csv', 'bts_scores_prop_firms.csv', 414),
    'tool': ('BTS_Trading_Tools_Researched.csv', 'bts_scores_tools.csv', 433),
}


def sources(row):
    found = {}
    def add(value, role):
        for url in (value or '').split('|'):
            url = url.strip()
            parsed = urlsplit(url)
            if parsed.scheme in ('http', 'https') and parsed.hostname:
                found.setdefault(url, {'url': url, 'roles': [], 'research_date': row['research_date'], 'verification': 'historical_research'})
                if role not in found[url]['roles']:
                    found[url]['roles'].append(role)
    for key in row:
        if key.endswith('_url') or key == 'source_urls':
            add(row[key], key)
    for licence in json.loads(row.get('regulatory_licences_json') or '[]'):
        add(licence.get('register_url'), 'licence_register')
    return list(found.values())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--research-dir', type=Path, required=True)
    parser.add_argument('--engine-zip', type=Path, required=True)
    parser.add_argument('--out-dir', type=Path, required=True)
    parser.add_argument('--as-of', default='2026-10-30')
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    manifest, duplicates, summary = [], [], {}
    with zipfile.ZipFile(args.engine_zip) as archive, tempfile.TemporaryDirectory() as temp:
        engine_path = Path(temp) / 'bts_scoring_engine.py'
        engine_path.write_bytes(archive.read('bts_scoring_engine.py'))
        spec = importlib.util.spec_from_file_location('supplied_bts_engine', engine_path)
        engine = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(engine)
        engine.TODAY = datetime.date.fromisoformat(args.as_of)
        config = json.loads(archive.read('bts_scoring_config.json'))
        for kind, (filename, scorefile, expected_count) in FILES.items():
            content = (args.research_dir / filename).read_bytes()
            digest = hashlib.sha256(content).hexdigest()
            rows = list(csv.DictReader(io.StringIO(content.decode('utf-8-sig'))))
            if len(rows) != expected_count or len({r['entity_id'] for r in rows}) != expected_count:
                raise ValueError(f'{filename}: incorrect count or duplicate entity IDs')
            expected = {r['entity_id']: r for r in csv.DictReader(io.StringIO(archive.read(scorefile).decode('utf-8-sig')))}
            sites = collections.defaultdict(list)
            issues_count = collections.Counter()
            total_links = 0
            for row in rows:
                licence_rows = json.loads(row.get('regulatory_licences_json') or '[]')
                if not isinstance(licence_rows, list):
                    raise ValueError(f"{row['entity_id']}: licences must be a JSON array")
                score = engine.score_broker(row, config)[0] if kind == 'broker' else engine.score_prop(row, config) if kind == 'propfirm' else engine.score_tool(row, config)
                original = expected.get(row['entity_id'])
                if original is None or any(str(value) != original.get(key) for key, value in score.items()):
                    raise ValueError(f"{row['entity_id']}: engine output differs from supplied score CSV")
                evidence = sources(row)
                total_links += len(evidence)
                issues = []
                cap = score.get('cap_applied', '')
                if cap and any(word in cap for word in ('warning', 'action', 'revoked', 'suspended', 'enforcement', 'criminal')):
                    issues.append('regulatory_cap_requires_entity_outcome_and_jurisdiction_review')
                    if not row.get('action_source_url'):
                        issues.append('regulatory_cap_source_not_supplied')
                actions = ' '.join(row.get(k, '') for k in ('verified_regulatory_actions', 'verified_official_actions', 'research_notes'))
                if cap and any(word in actions.lower() for word in ('secondary', 'relay', 'not verified at source', 'unverified')):
                    issues.append('secondary_evidence_must_not_be_treated_as_primary')
                if score['verdict'] == 'VERIFIED' and kind == 'propfirm' and not row.get('documented_material_disputes'):
                    issues.append('no_reported_dispute_does_not_verify_payout_reliability')
                if row['research_status'] == 'needs_review':
                    issues.append('needs_review_no_definitive_assessment')
                if row['operating_status'] != 'active':
                    issues.append('not_confirmed_active_no_positive_label')
                if not evidence:
                    issues.append('no_source_links_supplied')
                issues_count.update(issues)
                audit = {'version': 'bts-research-audit-1.0', 'engine_reproduced': True, 'as_of': args.as_of,
                         'policy_version': config['version'], 'uncapped_score': score['raw_score_before_cap'],
                         'cap_applied': cap or None, 'issues': issues, 'independent_live_review': 'pending'}
                record = {key: row.get(key) or None for key in ('entity_id', 'brand_name', 'website_url', 'legal_entity', 'registered_country', 'operating_status', 'research_status', 'research_date')}
                record.update({'source_urls': [s['url'] for s in evidence], 'research': row, 'input_sha256': digest, 'audit': audit})
                if kind == 'broker':
                    record['regulatory_licences_json'] = licence_rows
                manifest.append({'kind': kind, 'staging': record, 'sources': evidence, 'baseline': score})
                if row.get('website_url'):
                    website = urlsplit(row['website_url'])
                    key = (website.hostname or '').lower().removeprefix('www.') + website.path.rstrip('/')
                    sites[key].append({'entity_id': row['entity_id'], 'brand_name': row['brand_name'], 'legal_entity': row['legal_entity']})
            duplicates.extend({'kind': kind, 'website': site, 'records': group, 'status': 'review_required_not_automatically_merged'} for site, group in sites.items() if len(group) > 1)
            summary[kind] = {'records': len(rows), 'engine_reproduced': len(rows), 'source_links': total_links, 'issues': dict(issues_count), 'input_sha256': digest}
    result = {'summary': summary, 'duplicate_candidates': duplicates, 'records': manifest}
    output = args.out_dir / 'research-manifest.json'
    output.write_text(json.dumps(result, ensure_ascii=False))
    output.chmod(0o600)
    print(json.dumps({'manifest': str(output), 'summary': summary, 'shared_website_groups': len(duplicates)}))


if __name__ == '__main__':
    main()

-- Dividend events are no longer fetched or displayed.
delete from public.market_cache
where cache_key = 'events:dividends';

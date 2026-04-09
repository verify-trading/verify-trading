type Props = {
  message?: string;
};

export function AuthFieldError({ message }: Props) {
  if (!message) {
    return null;
  }
  return (
    <p className="mt-1.5 text-xs text-red-300" role="alert">
      {message}
    </p>
  );
}

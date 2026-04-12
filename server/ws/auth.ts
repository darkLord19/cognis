export function authenticateOperator(
  providedToken: string | undefined,
  expectedToken: string | undefined,
): boolean {
  if (!expectedToken) {
    return false;
  }

  return providedToken === expectedToken;
}

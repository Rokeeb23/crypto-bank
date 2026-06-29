export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidCryptoAddress(currency, address) {
  switch (currency.toUpperCase()) {
    case 'BTC':
      return /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
    case 'ETH':
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    case 'TRON':
      return /^T[a-zA-HJ-NP-Z0-9]{33}$/.test(address);
    default:
      return false;
  }
}

export function isPositiveNumber(value) {
  return !isNaN(value) && parseFloat(value) > 0;
}

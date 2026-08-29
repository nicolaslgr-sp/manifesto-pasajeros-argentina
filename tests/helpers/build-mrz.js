import { mrzDigit } from '../../src/mrz/parse.js';

export function buildLine2(doc, nat, birth, sex, expiry, optional = '123456789012345') {
  const docField = doc.padEnd(9, '<').slice(0, 9);
  const docCh = mrzDigit(docField);
  const birthCh = mrzDigit(birth);
  const expCh = mrzDigit(expiry);
  const body = docField + docCh + nat + birth + birthCh + sex + expiry + expCh + optional.slice(0, 15).padEnd(15, '<');
  const compCh = mrzDigit(body);
  return body + compCh;
}

export function buildLine1(issuer, surname, given) {
  const nameField = `${surname}<<${given}`.padEnd(39, '<').slice(0, 39);
  return `P<${issuer}${nameField}`;
}

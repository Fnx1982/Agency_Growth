/**
 * Códigos telefônicos por país (ISO → DDI), usados no campo de telefone do formulário Custom.
 * Os nomes dos países são gerados pelo navegador, em inglês.
 * EXAMPLES: exemplo de número local mostrado no campo, para os países mais prováveis.
 */
export const DIAL = {
  GB: "44", US: "1", IE: "353", CA: "1", AU: "61", NZ: "64", BR: "55", PT: "351", ES: "34", FR: "33",
  DE: "49", IT: "39", NL: "31", BE: "32", CH: "41", AT: "43", SE: "46", NO: "47", DK: "45", FI: "358",
  PL: "48", CZ: "420", SK: "421", HU: "36", RO: "40", BG: "359", GR: "30", HR: "385", SI: "386", RS: "381",
  UA: "380", LT: "370", LV: "371", EE: "372", IS: "354", LU: "352", MT: "356", CY: "357", TR: "90", IL: "972",
  AE: "971", SA: "966", QA: "974", KW: "965", BH: "973", OM: "968", JO: "962", LB: "961", EG: "20", MA: "212",
  DZ: "213", TN: "216", NG: "234", GH: "233", KE: "254", ZA: "27", ET: "251", TZ: "255", UG: "256", AO: "244",
  MZ: "258", CV: "238", SN: "221", CI: "225", CM: "237", IN: "91", PK: "92", BD: "880", LK: "94", NP: "977",
  CN: "86", HK: "852", TW: "886", JP: "81", KR: "82", SG: "65", MY: "60", TH: "66", VN: "84", PH: "63",
  ID: "62", MX: "52", AR: "54", CL: "56", CO: "57", PE: "51", VE: "58", EC: "593", BO: "591", PY: "595",
  UY: "598", CR: "506", PA: "507", GT: "502", HN: "504", SV: "503", NI: "505", DO: "1", PR: "1", JM: "1",
  TT: "1", BS: "1", BB: "1", CU: "53", HT: "509", RU: "7", KZ: "7", GE: "995", AM: "374", AZ: "994",
};

/** Países que aparecem primeiro na lista. */
export const TOP = ["GB", "US", "IE", "CA", "AU", "BR", "PT"];

export const EXAMPLES = {
  GB: "7400 123456", US: "201 555 0123", CA: "506 234 5678", IE: "85 012 3456", AU: "412 345 678",
  NZ: "21 123 4567", BR: "11 91234 5678", PT: "912 345 678", ES: "612 34 56 78", FR: "6 12 34 56 78",
  DE: "1512 3456789", IT: "312 345 6789",
};
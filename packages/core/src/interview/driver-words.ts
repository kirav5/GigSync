import {
  AcProblem,
  CarpenterProblem,
  DriverName,
  ElectricianProblem,
  Finish,
  HouseType,
  MaidTasks,
  PlumberProblem,
  Surface,
  Vehicle,
} from "@gigsync/protocol";

/**
 * Word lists for reading ADR 0041's price drivers from a household's own words, in English, Hindi, Kannada and
 * Hinglish. Like the other lists, entries are normalized on load, and four letters or more match inside longer words.
 * Each choice's list is checked in the order given, so a more specific value (inside and outside) comes first.
 */

const D = DriverName.enum;

/** A choice driver's values with the words that name each, most specific first. */
export type ChoiceWords = readonly (readonly [string, readonly string[]])[];

export const SURFACE_WORDS: ChoiceWords = [
  [
    Surface.enum.both,
    ["both", "inside and outside", "outside too", "outside also", "inside outside", "andar bahar", "bahar bhi"].concat([
      "दोनों",
      "ಎರಡೂ",
      "अंदर और बाहर",
      "अंदर बाहर",
      "बाहर भी",
      "ಒಳಗೆ ಮತ್ತು ಹೊರಗೆ",
      "ಒಳಗೂ ಹೊರಗೂ",
      "ಹೊರಗೂ",
    ]),
  ],
  [Surface.enum.outside, ["outside", "exterior", "outer wall", "bahar", "बाहर", "बाहरी", "ಹೊರಗೆ", "ಹೊರಭಾಗ"]],
  [Surface.enum.inside, ["inside", "interior", "andar", "अंदर", "भीतर", "ಒಳಗೆ", "ಒಳಭಾಗ"]],
];

export const HOUSE_WORDS: ChoiceWords = [
  [HouseType.enum.villa, ["villa", "विला", "ವಿಲ್ಲಾ"]],
  [
    HouseType.enum.independent,
    ["independent", "own house", "bungalow", "kothi", "स्वतंत्र मकान", "इंडिपेंडेंट", "कोठी", "बंगला"].concat([
      "ಸ್ವತಂತ್ರ ಮನೆ",
      "ಇಂಡಿಪೆಂಡೆಂಟ್",
      "ಬಂಗಲೆ",
    ]),
  ],
  [HouseType.enum.flat, ["flat", "apartment", "फ्लैट", "अपार्टमेंट", "ಫ್ಲ್ಯಾಟ್", "ಅಪಾರ್ಟ್ಮೆಂಟ್"]],
];

export const FINISH_WORDS: ChoiceWords = [
  [Finish.enum.texture, ["texture", "टेक्सचर", "ಟೆಕ್ಸ್ಚರ್"]],
  [Finish.enum.plain, ["plain", "simple paint", "emulsion", "सादा", "ಸಾದಾ"]],
];

export const TASK_WORDS: ChoiceWords = [
  [MaidTasks.enum.full, ["full house", "all work", "bathroom", "laundry", "clothes", "kapde", "कपड़े", "बाथरूम"]],
  [MaidTasks.enum.sweep_mop_dishes, ["dishes", "utensils", "bartan", "बर्तन", "ಪಾತ್ರೆ"]],
  [MaidTasks.enum.sweep_mop, ["sweep", "mop", "jhadu", "pocha", "झाड़ू", "पोछा", "ಗುಡಿಸು", "ಒರೆಸು"]],
];

export const VEHICLE_WORDS: ChoiceWords = [
  [Vehicle.enum.suv, ["suv", "innova", "एसयूवी", "ಎಸ್ಯುವಿ"]],
  [Vehicle.enum.sedan, ["sedan", "सेडान", "ಸೆಡಾನ್"]],
  [Vehicle.enum.hatchback, ["hatchback", "small car", "हैचबैक", "ಹ್ಯಾಚ್ಬ್ಯಾಕ್"]],
];

/** What a repair is for, by problem value; a trade reads only its own values. */
export const PROBLEM_KIND_WORDS: ChoiceWords = [
  [ElectricianProblem.enum.wiring, ["wiring", "वायरिंग", "ವೈರಿಂಗ್"]],
  [ElectricianProblem.enum.fan, ["fan", "pankha", "पंखा", "ಫ್ಯಾನ್"]],
  [ElectricianProblem.enum.switch, ["switch", "स्विच", "ಸ್ವಿಚ್"]],
  [ElectricianProblem.enum.light, ["light", "tube", "bulb", "लाइट", "ಲೈಟ್"]],
  [PlumberProblem.enum.leak, ["leak", "टपक", "लीक", "ಸೋರಿಕೆ", "ಲೀಕ್"]],
  [PlumberProblem.enum.toilet, ["toilet", "flush", "commode", "टॉयलेट", "ಟಾಯ್ಲೆಟ್"]],
  [PlumberProblem.enum.blockage, ["block", "clog", "choke", "जाम", "ब्लॉक", "ಬ್ಲಾಕ್"]],
  [PlumberProblem.enum.tap, ["tap", "nal", "नल", "ಟ್ಯಾಪ್", "ನಲ್ಲಿ"]],
  [CarpenterProblem.enum.door, ["door", "darwaza", "दरवाज", "ಬಾಗಿಲು"]],
  [CarpenterProblem.enum.assembly, ["assemble", "assembly", "फिटिंग", "ಜೋಡಣೆ"]],
  [AcProblem.enum.gas_refill, ["gas", "refill", "गैस", "ಗ್ಯಾಸ್"]],
  [AcProblem.enum.install, ["install", "इंस्टॉल", "ಅಳವಡಿಕೆ", "ಇನ್ಸ್ಟಾಲ್"]],
  [AcProblem.enum.service, ["service", "सर्विस", "ಸರ್ವೀಸ್"]],
  [CarpenterProblem.enum.repair, ["repair", "रिपेयर", "ರಿಪೇರಿ"]],
];

/** Count drivers by the word after the number ("2 floors", "6 दिन", "3 ಪಾಯಿಂಟ್"). */
export const DRIVER_COUNT_WORDS: Readonly<Partial<Record<DriverName, readonly string[]>>> = {
  [D.floors]: ["floors", "floor", "storeys", "storey", "story", "manzil", "मंजिल", "फ्लोर", "ಮಹಡಿ", "ಅಂತಸ್ತು"],
  [D.points]: ["points", "point", "switches", "taps", "fans", "lights", "doors", "units", "acs", "पॉइंट", "ಪಾಯಿಂಟ್"],
};

/** Bedrooms as "BHK" in Devanagari and Kannada script; the Latin "bhk" is the need interview's own list. */
export const ROOMS_WORDS = ["बीएचके", "ಬಿಎಚ್ಕೆ", "ಬಿಎಚ್‌ಕೆ"];

/** "6 days a week", "हफ्ते में 6 दिन", "ವಾರಕ್ಕೆ 6 ದಿನ": the days-a-week count, in its group. */
export const DAYS_WEEK_PATTERNS: readonly RegExp[] = [
  /(?<!\d)(\d) ?days? (?:a|per|in a|every) week/u,
  /(?:हफ्ते|हफ़्ते|सप्ताह) में (\d) दिन/u,
  /(\d) din (?:a )?(?:hafte|week)/u,
  /ವಾರಕ್ಕೆ (\d) ದಿನ/u,
];

/** "G+1" (ground plus one) is two floors; a duplex too. */
export const GROUND_PLUS = /(?<![a-z])g ?\+ ?(\d)(?!\d)/u;
export const DUPLEX_WORDS = ["duplex", "डुप्लेक्स", "ಡ್ಯೂಪ್ಲೆಕ್ಸ್"];
export const DUPLEX_FLOORS = 2;

/** "I don't know": always an answer to a driver question. */
export const DONT_KNOW_WORDS = ["dont know", "do not know", "not sure", "no idea", "pata nahi", "nahi pata"].concat([
  "मालूम नहीं",
  "पता नहीं",
  "नहीं पता",
  "ಗೊತ್ತಿಲ್ಲ",
  "ತಿಳಿದಿಲ್ಲ",
]);

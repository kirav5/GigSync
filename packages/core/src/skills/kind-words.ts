import type { WorkKind } from "@gigsync/protocol";

/**
 * Everyday words for each kind of work, beyond its name and the trades' own lists (`lexicon.ts`): the things the work
 * is done to and the doing words, in English, Hinglish, Hindi and Kannada, so "i sharpen wood", "lakdi ka kaam" and
 * "bal kaatna" land near Carpenter and Barber. They only ever suggest a kind for the worker to pick (`closest.ts`),
 * never set one, so a word may sit under two kinds. Comma-separated, one line a kind, to keep the table readable.
 */
export const KIND_WORDS: Readonly<Record<WorkKind, string>> = {
  // Trades: what their lists in `lexicon.ts` leave out.
  cook: "cooking, food, meals, tiffin, roti, chapati, sabzi, khana banana, rasoi, खाना, रोटी, ಅಡುಗೆ ಮಾಡು, ಊಟ, ಚಪಾತಿ",
  maid: "housemaid, house help, jhaadu, pochha, bai, kaamwali, बाई, ಮನೆ ಕೆಲಸದವರು, ಕಸ ಗುಡಿಸು, ಒರೆಸು",
  electrician: "fan, light, switch, socket, wire, current, bijli mistri, पंखा, तार, स्विच, ಫ್ಯಾನ್, ಲೈಟ್, ಸ್ವಿಚ್, ತಂತಿ",
  plumber: "tap, leak, drain, toilet, flush, nalka, nali, टोंटी, नाली, लीक, ಟ್ಯಾಪ್, ಸೋರಿಕೆ, ಚರಂಡಿ",
  carpenter:
    "wood, wooden, timber, plank, saw, chisel, door, cupboard, almirah, wardrobe, bed, table, chair, polish, lakdi, lakad, mistri, बढ़ई, लकड़ी, दरवाज़ा, अलमारी, फ़र्नीचर, ಮರ, ಮರದ, ಬಾಗಿಲು, ಕಪಾಟು, ಪೀಠೋಪಕರಣ",
  ac_technician: "cooling, split ac, window ac, ac gas, ac service, ठंडा, ಕೂಲಿಂಗ್",
  painter: "paint, wall paint, whitewash, colour, rang, rangai, distemper, पेंट, रंग, ಪೇಂಟ್, ಬಣ್ಣ ಹಚ್ಚು, ಗೋಡೆ ಬಣ್ಣ",
  driver: "drive, car, chauffeur, gaadi, gadi chalana, गाड़ी, ड्राइविंग, ಕಾರು, ಗಾಡಿ, ಓಡಿಸು",
  // Appliances
  tv_repair: "tv, television, led tv, lcd, टीवी, ಟಿವಿ, ಟೀವಿ",
  fridge_repair: "fridge, refrigerator, freezer, फ्रिज, ಫ್ರಿಜ್, ರೆಫ್ರಿಜರೇಟರ್",
  washing_machine_repair: "washing machine, washer, वॉशिंग मशीन, ವಾಷಿಂಗ್ ಮಷೀನ್",
  microwave_repair: "microwave, oven, otg, माइक्रोवेव, ओवन, ಮೈಕ್ರೋವೇವ್, ಓವನ್",
  geyser_repair: "geyser, water heater, heater, garam pani, गीज़र, गरम पानी, ಗೀಸರ್, ಬಿಸಿ ನೀರು",
  water_purifier_service: "purifier, ro, aquaguard, filter, water filter, फ़िल्टर, आरओ, ಪ್ಯೂರಿಫೈಯರ್, ಫಿಲ್ಟರ್",
  gas_stove_repair: "gas stove, stove, burner, hob, chulha, chula, चूल्हा, गैस, ಗ್ಯಾಸ್ ಸ್ಟೌ, ಒಲೆ",
  small_appliance_repair: "mixer, grinder, iron, kettle, appliance, मिक्सर, ಮಿಕ್ಸರ್, ಮಿಕ್ಸಿ, ಗ್ರೈಂಡರ್",
  air_cooler_repair: "cooler, air cooler, कूलर, ಕೂಲರ್",
  // Electronics
  inverter_service: "inverter, battery, ups, इन्वर्टर, बैटरी, ಇನ್ವರ್ಟರ್, ಬ್ಯಾಟರಿ",
  mobile_repair: "mobile, phone, smartphone, screen, मोबाइल, फ़ोन, ಮೊಬೈಲ್, ಫೋನ್",
  computer_repair: "computer, laptop, pc, desktop, printer, कंप्यूटर, लैपटॉप, ಕಂಪ್ಯೂಟರ್, ಲ್ಯಾಪ್‌ಟಾಪ್",
  cctv_installation: "cctv, camera, security camera, सीसीटीवी, कैमरा, ಸಿಸಿಟಿವಿ, ಕ್ಯಾಮೆರಾ",
  internet_setup: "internet, wifi, router, broadband, network, इंटरनेट, वाईफ़ाई, ಇಂಟರ್ನೆಟ್, ವೈಫೈ",
  // House work
  pest_control: "pest, cockroach, termite, rat, mosquito, bedbug, keede, दीमक, कॉकरोच, कीड़े, ಜಿರಳೆ, ಗೆದ್ದಲು, ಕೀಟ",
  deep_cleaning: "deep clean, full house cleaning, bathroom cleaning, kitchen cleaning, पूरी सफ़ाई, ಸಂಪೂರ್ಣ ಸ್ವಚ್ಛತೆ",
  sofa_cleaning: "sofa, carpet, mattress, shampoo, सोफ़ा, कालीन, ಸೋಫಾ, ಕಾರ್ಪೆಟ್",
  water_tank_cleaning: "water tank, tank, sump, overhead tank, टंकी, ಟ್ಯಾಂಕ್, ಸಂಪ್",
  waterproofing: "seepage, damp, leakage, terrace, roof leak, सीलन, छत, ಸೋರಿಕೆ, ತೇವ, ತಾರಸಿ",
  mason: "brick, cement, plaster, construction, wall, raj mistri, beldar, ईंट, सीमेंट, प्लास्टर, दीवार, ಇಟ್ಟಿಗೆ, ಸಿಮೆಂಟ್, ಗಾರೆ, ಗೋಡೆ",
  tile_work: "tile, tiles, marble, granite, flooring, टाइल, फ़र्श, ಟೈಲ್ಸ್, ನೆಲಹಾಸು",
  welder: "welding, iron gate, grill, metal, fabrication, वेल्डिंग, लोहा, ग्रिल, ವೆಲ್ಡಿಂಗ್, ಕಬ್ಬಿಣ",
  aluminium_glass_work: "glass, aluminium, window, sliding window, partition, कांच, शीशा, खिड़की, ಗಾಜು, ಕಿಟಕಿ",
  locksmith: "lock, key, chabi, tala, ताला, चाबी, ಬೀಗ, ಕೀಲಿ",
  // Outdoor and moving
  gardener: "garden, plants, trees, lawn, ped, paudhe, mali, bagicha, बगीचा, पौधे, पेड़, माली, ಉದ್ಯಾನ, ಗಿಡ, ಮರ, ತೋಟ",
  packers_movers: "shifting, moving, packing, house shifting, saman, सामान, शिफ़्टिंग, ಸಾಮಾನು, ಮನೆ ಬದಲಾವಣೆ",
  security_guard: "guard, watchman, security, chowkidar, gate, चौकीदार, गार्ड, ಕಾವಲುಗಾರ, ವಾಚ್‌ಮನ್",
  // Vehicles
  car_mechanic: "car repair, engine, garage, car service, गाड़ी ठीक, मैकेनिक, ಕಾರು ರಿಪೇರಿ, ಎಂಜಿನ್",
  bike_mechanic: "bike, scooter, motorcycle, two wheeler, puncture, बाइक, स्कूटर, ಬೈಕ್, ಸ್ಕೂಟರ್, ಪಂಕ್ಚರ್",
  car_wash: "car wash, car cleaning, bike wash, gaadi dhona, गाड़ी धोना, ಕಾರು ತೊಳೆ",
  // Care
  babysitter: "baby, child, children, kids, bachcha, bacche, nanny, aaya, बच्चा, बच्चे, आया, ಮಗು, ಮಕ್ಕಳು",
  elder_care: "elderly, old people, grandparents, bujurg, बुज़ुर्ग, ಹಿರಿಯರು, ವೃದ್ಧರು",
  home_nurse: "nurse, patient, injection, dressing, nursing, मरीज़, नर्स, ರೋಗಿ, ನರ್ಸ್",
  physiotherapist: "physio, physiotherapy, exercise, back pain, फ़िज़ियो, ಫಿಸಿಯೋ",
  pet_care: "dog, cat, pet, dog walking, kutta, कुत्ता, बिल्ली, ನಾಯಿ, ಬೆಕ್ಕು",
  // Personal
  tailor: "stitch, stitching, sewing, blouse, alteration, silai, darzi, सिलाई, दर्ज़ी, ಹೊಲಿಗೆ, ಹೊಲಿ, ಬಟ್ಟೆ ಹೊಲಿ, ದರ್ಜಿ, ಟೈಲರ್",
  laundry: "ironing, washing clothes, press, dhobi, kapde dhona, istri, धोबी, कपड़े, इस्त्री, ಬಟ್ಟೆ ಒಗೆ, ಇಸ್ತ್ರಿ",
  beautician: "beauty, parlour, facial, makeup, waxing, threading, bridal, ब्यूटी, पार्लर, ಬ್ಯೂಟಿ, ಮೇಕಪ್",
  barber: "hair, haircut, hair cut, shave, beard, baal, bal katna, nai, naai, बाल, नाई, दाढ़ी, ಕ್ಷೌರ, ಕೂದಲು, ಗಡ್ಡ",
  mehendi_artist: "mehendi, mehndi, henna, मेहंदी, ಮೆಹಂದಿ, ಗೋರಂಟಿ",
  cobbler: "shoe, shoes, chappal, sandal, mochi, boot, जूता, जूते, चप्पल, मोची, ಚಪ್ಪಲಿ, ಶೂ, ಚಮ್ಮಾರ",
  // Teaching
  school_tutor: "tuition, tutor, teach, teaching, homework, padhana, padhai, maths, science, ट्यूशन, पढ़ाना, ಪಾಠ, ಟ್ಯೂಷನ್",
  spoken_english_teacher: "spoken english, english speaking, english class, अंग्रेज़ी बोलना, ಇಂಗ್ಲಿಷ್ ಮಾತು",
  computer_teacher: "computer class, typing, excel, coding, कंप्यूटर सिखाना, ಕಂಪ್ಯೂಟರ್ ಕಲಿಕೆ",
  music_teacher: "music, singing, guitar, keyboard, tabla, harmonium, sangeet, संगीत, गाना, ಸಂಗೀತ, ಹಾಡು",
  dance_teacher: "dance, dancing, bharatanatyam, kathak, naach, नाच, डांस, ನೃತ್ಯ, ಡ್ಯಾನ್ಸ್",
  yoga_teacher: "yoga, meditation, pranayam, योग, ಯೋಗ",
  swimming_teacher: "swimming, swim, pool, tairna, तैरना, ಈಜು",
  driving_instructor: "driving school, learn driving, gaadi sikhana, ड्राइविंग सिखाना, ಡ್ರೈವಿಂಗ್ ಕಲಿಸು",
  gym_trainer: "gym, fitness, workout, trainer, weight loss, जिम, ಜಿಮ್, ಫಿಟ್ನೆಸ್",
  // Events
  photographer: "photo, photos, photography, video, wedding shoot, फ़ोटो, ಫೋಟೋ, ಛಾಯಾಗ್ರಾಹಕ",
  caterer: "catering, party food, wedding food, halwai, हलवाई, ಅಡುಗೆ ಕಂಟ್ರಾಕ್ಟ್, ಕ್ಯಾಟರಿಂಗ್",
  event_decorator: "decoration, decorate, flowers, balloons, tent, सजावट, ಅಲಂಕಾರ, ಹೂವಿನ ಅಲಂಕಾರ",
  priest: "pooja, puja, pandit, havan, purohit, पूजा, पंडित, ಪೂಜೆ, ಪುರೋಹಿತ, ಅರ್ಚಕ",
};

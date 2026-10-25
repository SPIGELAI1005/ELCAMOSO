/** ELCAMOSO news feed. Each item becomes visible at its Berlin publish time (same slot as on X). */
export type NewsItem = { id: string; publishAt: string; text: string; image?: string };

const DIR = "/news/week-oct26/";

export const NEWS_ITEMS: NewsItem[] = [
  {
    id: "wk-oct26-01",
    publishAt: "2026-10-26T08:00:00+01:00",
    text: "Monday starts with a Racing V10 in Race mode. Now the default sound in ELCAMOSO. Press start.",
    image: DIR + "02_v10_race_default.jpg",
  },
  {
    id: "wk-oct26-02",
    publishAt: "2026-10-26T12:30:00+01:00",
    text: "Founders Pack is open. Sign up and confirm your email before 09.11. Keep Racing V10, American Muscle V8 and GT V8 free forever. Plus 6 months Drive+.",
    image: DIR + "01_founders_pack.jpg",
  },
  {
    id: "wk-oct26-03",
    publishAt: "2026-10-26T17:30:00+01:00",
    text: "Commute home or test lap? Same road. Different soundtrack.",
  },
  {
    id: "wk-oct26-04",
    publishAt: "2026-10-26T21:00:00+01:00",
    text: "14 days left to become a Founder. Seats are limited. Exclusive Crew perks to follow.",
    image: DIR + "09_countdown_14_days.jpg",
  },
  {
    id: "wk-oct26-05",
    publishAt: "2026-10-27T08:00:00+01:00",
    text: "New on ELCAMOSO: the Crew. Drive, collect smiles, level up.",
    image: DIR + "03_join_the_crew.jpg",
  },
  {
    id: "wk-oct26-06",
    publishAt: "2026-10-27T12:30:00+01:00",
    text: "Cruiser. Smiler. Grinner. Joyrider. Legend. Where do you start, and how far do you go?",
  },
  {
    id: "wk-oct26-07",
    publishAt: "2026-10-27T17:30:00+01:00",
    text: "Weekly leaderboard resets every Monday. Every drive counts. Every smile counts.",
    image: DIR + "10_weekly_leaderboard.jpg",
  },
  {
    id: "wk-oct26-08",
    publishAt: "2026-10-27T21:00:00+01:00",
    text: "13 days left. Founders seats left are going. Sign up and confirm your email before 09.11.",
    image: DIR + "11_countdown_13_days.jpg",
  },
  {
    id: "wk-oct26-09",
    publishAt: "2026-10-28T08:00:00+01:00",
    text: "O))) for the miles. Turn it and the arcs become a smile. That is Smiles per Mile.",
    image: DIR + "04_smiles_per_mile.jpg",
  },
  {
    id: "wk-oct26-10",
    publishAt: "2026-10-28T12:30:00+01:00",
    text: "Your drive, scored in smiles. Not speed. Not distance. Joy.",
    image: DIR + "12_scored_in_joy.jpg",
  },
  {
    id: "wk-oct26-11",
    publishAt: "2026-10-28T17:30:00+01:00",
    text: "How many smiles did your commute earn today? Post your card.",
  },
  {
    id: "wk-oct26-12",
    publishAt: "2026-10-28T21:00:00+01:00",
    text: "12 days left for the Founders Pack. Three sounds free forever. Do not wait for the last seat.",
    image: DIR + "13_countdown_12_days.jpg",
  },
  {
    id: "wk-oct26-13",
    publishAt: "2026-10-29T08:00:00+01:00",
    text: "Not every drive needs cylinders. The carriage sounds now breathe. Listen at the light.",
    image: DIR + "05c_horse_carriage.jpg",
  },
  {
    id: "wk-oct26-14",
    publishAt: "2026-10-29T12:30:00+01:00",
    text: "Stand still and the horses settle. Floor it and they answer. Brake and they rest.",
    image: DIR + "14_horses_breathe.jpg",
  },
  {
    id: "wk-oct26-15",
    publishAt: "2026-10-29T17:30:00+01:00",
    text: "Racing V10 or horse carriage for tonight's drive home? Pick one.",
  },
  {
    id: "wk-oct26-16",
    publishAt: "2026-10-29T21:00:00+01:00",
    text: "11 days left. Founders seats left are limited. Exclusive Crew perks to follow.",
    image: DIR + "15_countdown_11_days.jpg",
  },
  {
    id: "wk-oct26-17",
    publishAt: "2026-10-30T08:00:00+01:00",
    text: "Bring a friend to ELCAMOSO. They get 1 month of Drive+. You earn up to 6 months.",
    image: DIR + "06_bring_a_friend.jpg",
  },
  {
    id: "wk-oct26-18",
    publishAt: "2026-10-30T12:30:00+01:00",
    text: "Best roads are better with company. Send your invite from the Crew page.",
    image: DIR + "16_better_with_company.jpg",
  },
  {
    id: "wk-oct26-19",
    publishAt: "2026-10-30T17:30:00+01:00",
    text: "Weekend loading. Which sound starts yours?",
  },
  {
    id: "wk-oct26-20",
    publishAt: "2026-10-30T21:00:00+01:00",
    text: "10 days left to claim the Founders Pack. Sign up, confirm your email, keep the sounds.",
    image: DIR + "17_countdown_10_days.jpg",
  },
  {
    id: "wk-oct26-21",
    publishAt: "2026-10-31T08:00:00+01:00",
    text: "9 days left. Founders seats closing 09.11. at 23:59 Berlin.",
    image: DIR + "08_countdown_9_days.jpg",
  },
  {
    id: "wk-oct26-22",
    publishAt: "2026-10-31T12:30:00+01:00",
    text: "Smile Shop is open. Spend your smiles on card themes. Midnight. Ember. Chrome.",
    image: DIR + "07_smile_shop_themes.jpg",
  },
  {
    id: "wk-oct26-23",
    publishAt: "2026-10-31T17:30:00+01:00",
    text: "Earn it. Drive it. Show it. Your card, your colours.",
    image: DIR + "18_your_colours.jpg",
  },
  {
    id: "wk-oct26-24",
    publishAt: "2026-10-31T21:00:00+01:00",
    text: "Saturday night drive. Share your Smiles per Mile card and climb the leaderboard.",
    image: DIR + "19_saturday_night.jpg",
  },
  {
    id: "wk-oct26-25",
    publishAt: "2026-11-01T08:00:00+01:00",
    text: "New month, new Crew challenge. Most smiles wins. Starts today.",
    image: DIR + "03_join_the_crew.jpg",
  },
  {
    id: "wk-oct26-26",
    publishAt: "2026-11-01T12:30:00+01:00",
    text: "This week on ELCAMOSO: Crew levels, Smiles per Mile, Smile Shop themes, breathing horses, invites with Drive+.",
    image: DIR + "20_week_recap.jpg",
  },
  {
    id: "wk-oct26-27",
    publishAt: "2026-11-01T17:30:00+01:00",
    text: "Sunday drive, old school. Horsepower. Literally. Try the carriage sounds today.",
    image: DIR + "05_horse_carriage.jpg",
  },
  {
    id: "wk-oct26-28",
    publishAt: "2026-11-01T21:00:00+01:00",
    text: "8 days left. Become a Founder before 09.11. Three sounds free forever, 6 months Drive+, Crew perks to follow.",
    image: DIR + "01_founders_pack.jpg",
  },
];

/** Items already published at `now`, newest first. */
export function getVisibleNewsItems(
  now: Date | number = Date.now(),
  items: NewsItem[] = NEWS_ITEMS,
): NewsItem[] {
  const t = typeof now === "number" ? now : now.getTime();
  return items
    .filter((item) => Date.parse(item.publishAt) <= t)
    .sort((a, b) => Date.parse(b.publishAt) - Date.parse(a.publishAt));
}

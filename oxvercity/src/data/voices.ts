/**
 * Community voices shown on the home page.
 *
 * Three real reviews of St. Xavier's College, Kolkata, quoted as supplied. The
 * wording, the names and the courses are the reviewers' own — nothing here is
 * written for the site, and no fourth voice should be invented to pad the
 * sequence out. `VoicesSection` derives its scroll choreography from the length
 * of this array, so adding or removing a review re-spaces the passes on its own.
 *
 * The order alternates the cards between the right and left of the composition,
 * which is the order they were given in.
 *
 * None of the three published a photograph, so `VoicesSection` draws a monogram
 * from the name rather than showing a stand-in face.
 */
export interface Voice {
  /** The reviewer's name, as published. */
  name: string;
  /** Course and college, in the reviewer's own words. */
  role?: string;
  /** An excerpt from the review. */
  comment: string;
}

export const voices: Voice[] = [
  {
    name: 'Priya',
    role: 'B.Sc. Chemistry Honours, St. Xavier’s College, Kolkata',
    comment:
      'I passed out of Xavier’s this year. Honestly, I miss it so much even today. You know how people say, Once a Xaverian, always a Xaverian? It’s a hundred percent true.',
  },
  {
    name: 'Snehal Garg',
    role: 'B.Com. (Hons.), St. Xavier’s College, Kolkata',
    comment:
      'Basically, this college has a nice atmosphere of toppers and over achievers. You don’t get to talk to any person who takes life easy. And you are looked down at if you are of the present generation ‘chilled dude’ category. It is the ambience that gives you a zeal to be someone, to be one of your kind.',
  },
  {
    name: 'Shivam Mehra',
    role: 'Studied at St. Xavier’s College, Kolkata',
    comment: 'It will change you for the best. It will brand you for the rest of your life.',
  },
];

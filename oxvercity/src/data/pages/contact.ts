/** Content of the contact page: the intro, contact details, social links and FAQ. */

export const contactPage = {
  title: 'Stay connected with SXCCAA',
  intro:
    'Have a question, or want to reconnect with the Xaverian community? Whether it is the alumni directory, a chapter, an Association initiative or an event, our team is here to help.',
  followLabel: 'Follow Us -',
  /**
   * Social accounts are left pointing at the platforms until SXCCAA confirms
   * its official handles; nothing here claims to be an Association account.
   */
  socials: [
    { name: 'LinkedIn', href: 'https://www.linkedin.com/', icon: '/svg/icons/social-linkedin.svg' },
    { name: 'X', href: 'https://x.com/', icon: '/svg/icons/social-x.svg' },
    { name: 'Instagram', href: 'https://www.instagram.com/', icon: '/svg/icons/social-instagram.svg' },
    { name: 'Dribbble', href: 'https://dribbble.com/', icon: '/svg/icons/social-dribbble.svg' },
  ],
  form: {
    nameLabel: 'Full name*',
    namePlaceholder: 'Your full name',
    emailLabel: 'Email*',
    emailPlaceholder: 'you@example.com',
    messageLabel: 'Message',
    messagePlaceholder: 'Tell us how we can help...',
    consent: 'I agree to the SXCCAA privacy policy and terms of use.',
    submit: 'Send Message',
    sending: 'Sending…',
    sent: 'Message sent',
    error: 'Could not send, try again',
    /**
     * Where the enquiry goes. Required: an unset action used to report success
     * and throw the message away — see the header of SiteForm.tsx.
     */
    action: '/api/enquiry',
  },
  faqTitle: 'FAQS',
};

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * The FAQ accordion. The first item opens by default. The answers describe
 * how this platform is designed to work — they make no claim about Association
 * policy that SXCCAA has not set.
 */
export const faq: FaqItem[] = [
  {
    question: 'How do I find another Xaverian in the directory?',
    answer:
      'Open the alumni directory and search by name, company, designation or location. You can also narrow the list by graduating year, programme, department, industry and city, or show only alumni who are open to being contacted.',
  },
  {
    question: 'Why can I not see an alumnus’s email address or phone number?',
    answer:
      'By design. Personal contact details are never shown on the public site. If an alumnus is open to connecting, you send a connection request instead, and their contact details are released to you only if they accept it.',
  },
  {
    question: 'How does a connection request work?',
    answer:
      'You complete a short form on the profile, verify your email address with a one-time code, and the request goes to the Association for review. If it is approved, the alumnus receives it and can accept or decline. Nothing is shared until they accept.',
  },
  {
    question: 'I am an alumnus. How do I get listed, or correct my details?',
    answer:
      'Alumni records are maintained by the Association. Write to us using the form on this page with your name, graduating year and programme, and the Association will update your record.',
  },
  {
    question: 'How do I ask for my details to be removed?',
    answer:
      'Contact the Association using the form on this page. Every record carries visibility and consent flags, and a record can be withdrawn from the public directory at any time while remaining in the Association’s own archive.',
  },
  {
    question: 'How can I get involved with SXCCAA’s initiatives?',
    answer:
      'The Association runs fellowship gatherings, chapter activities and community initiatives through the year. Get in touch using the form on this page and tell us how you would like to help — mentoring, referrals, guest lectures or internships.',
  },
];

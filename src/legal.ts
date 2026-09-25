import { CONTACT_URL, LEGAL_UPDATED, SITE_NAME } from "./config";

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export const legal = {
  title: "Terms of Use & Privacy Policy",
  updated: `Last updated: ${LEGAL_UPDATED}`,
  intro: `These terms and this privacy policy apply to ${SITE_NAME} (the "Site") and all games available on it (the "Games"). By using the Site you agree to them. If you do not agree, please do not use the Site.`,
  contactLabel: "Questions? Contact us through the project's GitHub page",
  contactUrl: CONTACT_URL,

  terms: [
    {
      heading: "1. Purpose",
      paragraphs: [
        "The Site and the Games are provided free of charge, for educational and entertainment purposes only. They are intended to help people practise basic math skills. They are not a substitute for formal education, tutoring, assessment or professional advice of any kind.",
      ],
    },
    {
      heading: "2. Provided \"as is\"",
      paragraphs: [
        "The Site and the Games are provided \"as is\" and \"as available\", without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, accuracy, availability and non-infringement. We do not warrant that the Site will be uninterrupted, error-free or free of harmful components, or that any content (including math tasks and answers) is complete or correct.",
      ],
    },
    {
      heading: "3. Limitation of liability",
      paragraphs: [
        "To the fullest extent permitted by applicable law, the developer and contributors of the Site shall not be liable for any direct, indirect, incidental, special, consequential or exemplary damages, or for any loss (including loss of data or progress), injury or other outcome arising out of or in connection with the use of, or inability to use, the Site or the Games. You use the Site at your own risk.",
        "Please take regular breaks while playing. If you or your child have a medical condition such as photosensitive epilepsy, consult a doctor before playing video games.",
      ],
    },
    {
      heading: "4. Children",
      paragraphs: [
        "The Games are designed to be suitable for children. We recommend that children use the Site under the supervision of a parent, guardian or teacher.",
      ],
    },
    {
      heading: "5. Donations and external links",
      paragraphs: [
        "The Site may link to third-party websites, including Buy Me a Coffee for voluntary donations. Donations are optional, are not required to use the Site and do not purchase any goods, services or features. Third-party websites are governed by their own terms and privacy policies, and we are not responsible for their content or practices.",
      ],
    },
    {
      heading: "6. Changes",
      paragraphs: [
        "We may update these terms and this privacy policy at any time. Changes take effect when they are published on this page. Continued use of the Site after a change means you accept the updated version.",
      ],
    },
  ] as LegalSection[],

  privacy: [
    {
      heading: "Information we collect",
      paragraphs: [
        "We do not collect, store or process any personal information. The Site has no user accounts, no sign-up forms, no advertising, no analytics or tracking tools, and does not set cookies.",
      ],
    },
    {
      heading: "Game progress",
      paragraphs: [
        "Your game progress and settings (such as the level reached and the selected difficulty) are saved only in your own browser, using its local storage. This data never leaves your device: it is not sent to us or to anyone else, and the developer does not store it anywhere.",
        "You can delete it at any time by clearing this Site's data in your browser settings. Clearing it, using private browsing, or switching to another browser or device will reset your progress.",
      ],
    },
    {
      heading: "Hosting",
      paragraphs: [
        "The Site is hosted on GitHub Pages. Like any web host, GitHub may automatically log technical information such as your IP address when your browser requests the Site, for security and operational purposes. This is handled by GitHub under the GitHub Privacy Statement; we do not have access to these logs and do not use them.",
      ],
    },
    {
      heading: "Children's privacy",
      paragraphs: [
        "Because we do not collect personal information from anyone, we do not knowingly collect personal information from children.",
      ],
    },
  ] as LegalSection[],
};

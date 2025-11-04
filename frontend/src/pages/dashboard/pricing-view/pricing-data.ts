
export const PRICING_DATA = {
  free: {
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: {
      'Access to Threat Tracker': true,
      'Access to News Radar': true,
      'Access Tech Stack Overview Page': true,
      'Access to CVE Reporter': false,
      'Access to Report Center': false,
      'Sources Available': '5',
      'Custom Tech Stack Keywords': '10',
      'Import Tech Stack from API or CVE': false,
      'Number of Users': '1',
      'Themes': 'Dark',
    }
  },
  pro: {
    name: 'Pro',
    monthlyPrice: 99,
    yearlyPrice: 999,
    features: {
      'Access to Threat Tracker': true,
      'Access to News Radar': true,
      'Access Tech Stack Overview Page': true,
      'Access to CVE Reporter': false,
      'Access to Report Center': false,
      'Sources Available': '15',
      'Custom Tech Stack Keywords': '50',
      'Import Tech Stack from API or CVE': false,
      'Number of Users': '1',
      'Themes': 'Light/Dark',
    }
  },
  enterprise: {
    name: 'Enterprise',
    monthlyPrice: null,
    yearlyPrice: null,
    features: {
      'Access to Threat Tracker': true,
      'Access to News Radar': true,
      'Access Tech Stack Overview Page': true,
      'Access to CVE Reporter': true,
      'Access to Report Center': true,
      'Sources Available': 'All',
      'Custom Tech Stack Keywords': 'Unlimited',
      'Import Tech Stack from API or CVE': false,
      'Number of Users': '3',
      'Themes': 'Light/Dark',
    }
  },
  custom: {
    name: 'Custom',
    monthlyPrice: null,
    yearlyPrice: null,
    features: {
      'Access to Threat Tracker': true,
      'Access to News Radar': true,
      'Access Tech Stack Overview Page': true,
      'Access to CVE Reporter': true,
      'Access to Report Center': true,
      'Sources Available': 'All',
      'Custom Tech Stack Keywords': 'Unlimited',
      'Import Tech Stack from API or CVE': true,
      'Number of Users': 'Custom',
      'Themes': 'Whitelabel',
    }
  }
};

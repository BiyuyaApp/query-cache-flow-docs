// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const {themes} = require('prism-react-renderer');
const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'CACHE-FLOW',
  tagline: 'Zero-Thought Cache Management for TanStack Query',
  favicon: 'img/favicon.svg',

  url: 'https://cache-flow.dev',
  baseUrl: '/docs/',

  organizationName: 'cache-flow',
  projectName: 'cache-flow-docs',

  onBrokenLinks: 'warn',
  trailingSlash: false,

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/cache-flow/cache-flow-docs/tree/main/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'CACHE-FLOW',
        logo: {
          alt: 'CACHE-FLOW Logo',
          src: 'img/logo.svg',
          href: '/docs/intro',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentation',
          },
          {
            href: 'https://cache-flow.dev',
            label: 'Home',
            position: 'right',
            className: 'navbar-home-link',
          },
          {
            href: 'https://github.com/cache-flow/cache-flow',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Getting Started',
                to: '/getting-started/installation',
              },
              {
                label: 'Core Concepts',
                to: '/core-concepts/query-keys',
              },
              {
                label: 'API Reference',
                to: '/api-reference/createQueryGroupCRUD',
              },
            ],
          },
          {
            title: 'Resources',
            items: [
              {
                label: 'TanStack Query',
                href: 'https://tanstack.com/query',
              },
              {
                label: 'KUBB',
                href: 'https://kubb.dev',
              },
              {
                label: 'OpenAPI',
                href: 'https://www.openapis.org',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Home',
                href: 'https://cache-flow.dev',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/cache-flow/cache-flow',
              },
            ],
          },
        ],
        copyright: `CACHE-FLOW is an open pattern for TanStack Query cache management. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: ['typescript', 'javascript', 'jsx', 'tsx'],
      },
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
    }),
};

module.exports = config;

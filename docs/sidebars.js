/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    {
      type: 'doc',
      id: 'intro',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/project-structure',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'core-concepts/query-keys',
        'core-concepts/query-groups',
        'core-concepts/crud-factory',
        'core-concepts/key-injection',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api-reference/createQueryGroupCRUD',
        'api-reference/invalidateQueriesForKeys',
        'api-reference/cancelQueriesForKeys',
        'api-reference/inyectKeysToQueries',
      ],
    },
    {
      type: 'category',
      label: 'Patterns',
      items: [
        'patterns/wrapper-hooks',
        'patterns/cascade-invalidation',
        'patterns/optimistic-updates',
        'patterns/pagination',
        'patterns/entity-mapping',
      ],
    },
    {
      type: 'category',
      label: 'Advanced',
      items: [
        'advanced/kubb-integration',
        'advanced/axios-interceptors',
        'advanced/migration-guide',
      ],
    },
    {
      type: 'doc',
      id: 'glossary',
      label: 'Glossary',
    },
  ],
};

module.exports = sidebars;

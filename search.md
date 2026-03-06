---
layout: base
title: Search
description: Search the Decentralized FDA wiki
permalink: /search/
templateEngineOverride: njk,md
---

<section class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
  <header class="mb-8">
    <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Search</h1>
    <p class="mt-3 text-gray-600 dark:text-gray-300">Find matching posts and pages as you type.</p>
  </header>

  <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm dark:bg-gray-800 dark:border-gray-700">
    <label for="post-search-input" class="sr-only">Search posts</label>
    <input
      id="post-search-input"
      type="search"
      placeholder="Search posts and pages..."
      class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
      autocomplete="off"
    />
    <p class="mt-3 text-sm text-gray-600 dark:text-gray-300">
      <span id="search-result-count"></span>
    </p>
  </div>

  <ul id="search-results" class="mt-6 space-y-3">
{% for item in collections.allPages | sortByTitle %}
{% if item.url and item.url != '/search/' and item.data.title %}
  <li class="search-result-item rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
      data-search="{{ (item.data.title ~ ' ' ~ (item.data.description or '') ~ ' ' ~ item.url) | lower | escape }}">
    <a href="{{ item.url }}" class="text-lg font-semibold text-primary-700 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300">
      {{ item.data.title }}
    </a>
    <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
      {{ item.data.description or item.url }}
    </p>
  </li>
{% endif %}
{% endfor %}
  </ul>

  <p id="search-empty-state" class="hidden mt-6 text-gray-600 dark:text-gray-300">
    No matching posts found.
  </p>
</section>

<script>
  document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('post-search-input');
    const items = Array.from(document.querySelectorAll('.search-result-item'));
    const count = document.getElementById('search-result-count');
    const emptyState = document.getElementById('search-empty-state');

    if (!input || !count || !emptyState) return;

    function updateResults() {
      const terms = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
      let visible = 0;

      items.forEach((item) => {
        const haystack = item.dataset.search || '';
        const matches = terms.every((term) => haystack.includes(term));
        item.classList.toggle('hidden', !matches);
        if (matches) visible++;
      });

      count.textContent = `${visible} result${visible === 1 ? '' : 's'}`;
      emptyState.classList.toggle('hidden', visible !== 0);
    }

    input.addEventListener('input', updateResults);
    updateResults();
    input.focus();
  });
</script>

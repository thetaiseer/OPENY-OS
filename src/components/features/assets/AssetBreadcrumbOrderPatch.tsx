'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function reorderAssetBreadcrumbs() {
  if (!window.location.pathname.startsWith('/assets')) return;

  document.querySelectorAll('nav').forEach((nav) => {
    if ((nav as HTMLElement).dataset.openyAssetOrderApplied === '1') return;

    const items = Array.from(nav.children);
    if (items.length < 6) return;

    const text = nav.textContent ?? '';
    if (!/20\d{2}/.test(text)) return;

    const yearItem = items[3];
    const subCategoryItem = items[5];
    if (!yearItem || !subCategoryItem) return;

    nav.insertBefore(subCategoryItem, yearItem);
    (nav as HTMLElement).dataset.openyAssetOrderApplied = '1';
  });
}

export default function AssetBreadcrumbOrderPatch() {
  const pathname = usePathname();

  useEffect(() => {
    reorderAssetBreadcrumbs();

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(reorderAssetBreadcrumbs);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}

/**
 * Fix remaining link issues:
 * - Broken anchors with special characters
 * - Remove links to genuinely missing files
 * - Fix malformed URLs
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const workspaceRoot = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

// Anchor fixes: old -> new
const anchorFixes: Record<string, string> = {
  '#identify-dysfunctional-negative-thoughts-hint:-e282acc593shouldinge282acefbfbd-at-oneself-others-or-the-universe': '#identify-dysfunctional-negative-thoughts-hint-shoulding-at-oneself-others-or-the-universe',
  '#life-is-a-game-€"-a-losing-game': '#life-is-a-game-a-losing-game',
  '#protecting-the-people€™s-data': '#protecting-the-peoples-data',
  '#myth:-proprietary-software-are-secure-and-not-prone-to-attacks': '#myth-proprietary-software-is-secure-and-not-prone-to-attacks',
  '#institute-for-health-metrics-and-evaluation-global-health-data-exchange-ghdx': '#institute-for-health-metrics-and-evaluation-global-health-data-exchange-ghdx',
  '#bromantane-25-50mg-sublingually-for-8-12-weeks': '#bromantane-25-50-mg-sublingual-for-8-12-weeks',
  '#cerebrolysin-+-cortexin-5ml-+-5mg-intramuscularly-daily-for-6-8-weeks': '#cerebrolysin---cortexin-5ml---5-mg-intramuscularly-daily-for-6-8-weeks',
  '#9-me-bc-10-20mg-orally-for-6-8-weeks': '#9-me-bc-10-20-mg-orally-for-6-8-weeks',
  '#optionals:': '#optional',
  '#jiaogulan/gynostemma-pentaphyllum-4098%-gypenosides-410-820mg-daily-for-6-8-weeks': '#jiaogulangynostemma-pentaphyllum-98-gypenosides-410-820-mg-daily-for-6-8-weeks',
  '#mr-happy-stack-300mg-uridine-monophosphate-+-700mg-dha-+-400mcg-folate-for-8-12-weeks': '#mr-happy-stack-300-mg-uridine-monophosphate---700-mg-dha---400mcg-folate-for-8-12-weeks',
  '#nsi-189-phosphate-40mg-once-daily-for-8-12-weeks': '#nsi-189-phosphate-40-mg-once-daily-for-8-12-weeks',
  '#agmatine-sulfate-250mg-daily-+-magnesium-l-threonate-144mg-elemental-mg-daily': '#agmatine-sulfate-250-mg-daily---magnesium-l-threonate-144-mg-elemental-mg-daily',
  '#side-effect-warning': '#side-effect-warnings',
  '#alzheimers': '#alzheimers',
  '#bupropion-wellbutrin': '#bupropion-wellbutrin',
  '#dl-phenylalanine-dlpa-l-phenylalanine-and-nalt': '#dl-phenylalanine-dlpa-l-phenylalanine-and-nalt',
  '#safety-concerns-2': '#safety-concerns-1',
  '#phenylethylamine-pea': '#phenylethylamine-pea',
  '#productivity': '#productivity',
  '#mao-inhibition': '#mao-inhibition',
  '#receptor-changes': '#receptor-changes',
  '#neurogenesis': '#neurogenesis',
  '#corticotropin-releasing-factor': '#corticotropin-releasing-factor',
  '#insuffalation': '#insufflation',
  '#mad-price-ball-executive-director': '#mad-price-ball---executive-director',
  '#bastian-greshake-tzovaras-director-of-research-part-time': '#bastian-greshake-tzovaras---director-of-research-part-time',
  '#mairi-dulaney-web-admin-/-operations-volunteer': '#mairi-dulaney---web-admin--operations-volunteer',
  '#2-earlier-access-7-years-sooner': '#2-earlier-access-7-years-sooner',
  '#ipgrp.org': '#ipgrporg',
  '#examples': '#other-examples',
};

// Links to remove (genuinely missing files)
const linksToRemove = [
  'coding_standards.md',
  'data_handling_protocols.md',
  'project_collaboration_guidelines.md',
  '../templates/developer_introduction.md',
  'apis/Medsphere/open-vista_mu_api',
];

// Image links to remove (missing images)
const imagesToRemove = [
  '../../../img/optimitron-ai-assistant.png',
  '../../img/optimitron-ai-assistant.png',
  '/img/cost-clinical-research-with-automation-pointer-1024x740.jpg',
  '../../img/web-notification-curcumin-300x253.jpg',
  '../../img/causal-inference-2-1.jpg',
  '../../img/gluten-study.jpg',
  '../../img/onset-delay-970x1024.jpg',
  '../../img/real-time-decision-support-notifications-personalized-app-image.jpg',
];

async function main() {
  console.log('🔧 Fix Remaining Issues');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('DRY RUN MODE - No files will be modified\n');
  }

  const files = await glob('**/*.md', {
    cwd: workspaceRoot,
    ignore: ['**/node_modules/**', '**/_site/**', '**/.git/**', 'broken-links-report.md'],
  });

  let totalFixes = 0;
  let filesFixed = 0;

  for (const file of files) {
    const fullPath = path.join(workspaceRoot, file);
    let content = fs.readFileSync(fullPath, 'utf-8');
    let originalContent = content;
    const fixes: string[] = [];

    // Fix anchors
    for (const [oldAnchor, newAnchor] of Object.entries(anchorFixes)) {
      if (content.includes(oldAnchor)) {
        content = content.split(oldAnchor).join(newAnchor);
        fixes.push(`  Anchor: ${oldAnchor.substring(0, 50)}... → ${newAnchor}`);
      }
    }

    // Remove broken links to missing files
    for (const link of linksToRemove) {
      const linkRegex = new RegExp(`\\[([^\\]]*)\\]\\(${link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
      if (linkRegex.test(content)) {
        content = content.replace(linkRegex, '$1');
        fixes.push(`  Removed link: ${link}`);
      }
    }

    // Remove broken image links
    for (const img of imagesToRemove) {
      const imgRegex = new RegExp(`!\\[[^\\]]*\\]\\(${img.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
      if (imgRegex.test(content)) {
        content = content.replace(imgRegex, '');
        fixes.push(`  Removed image: ${img}`);
      }
    }

    // Remove #sources anchors that don't exist (common pattern)
    const sourcesRegex = /\[([^\]]+)\]\(#sources\)/g;
    if (sourcesRegex.test(content)) {
      content = content.replace(sourcesRegex, '$1');
      fixes.push('  Removed #sources anchor links');
    }

    // Remove #reviews anchors
    const reviewsRegex = /\[([^\]]+)\]\(#reviews\)/g;
    if (reviewsRegex.test(content)) {
      content = content.replace(reviewsRegex, '$1');
      fixes.push('  Removed #reviews anchor links');
    }

    // Remove #dosage anchors
    const dosageRegex = /\[([^\]]+)\]\(#dosage\)/g;
    if (dosageRegex.test(content)) {
      content = content.replace(dosageRegex, '$1');
      fixes.push('  Removed #dosage anchor links');
    }

    // Fix numbered anchors in dfda-cost-benefit-analysis references
    content = content.replace(/#42-decentralized-trial-costs-modeled-on-oxford-recovery/g, '#decentralized-trial-costs-modeled-on-oxford-recovery');
    content = content.replace(/#43-overall-savings/g, '#overall-savings');
    content = content.replace(/#5-roi-analysis/g, '#roi-analysis');
    content = content.replace(/#7-annual-benefits-summary/g, '#annual-benefits-summary');
    content = content.replace(/#8-references/g, '#references');
    content = content.replace(/\/#2-personalfda-nodes/g, '#personalfda-nodes');

    if (content !== originalContent) {
      filesFixed++;
      totalFixes += fixes.length;

      console.log(`\n📄 ${file}:`);
      fixes.forEach(f => console.log(f));

      if (!dryRun) {
        fs.writeFileSync(fullPath, content, 'utf-8');
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Files fixed: ${filesFixed}`);
  console.log(`Total fixes: ${totalFixes}`);

  if (dryRun) {
    console.log('\nThis was a dry run. Run without --dry-run to apply fixes.');
  } else {
    console.log('\n✅ Fixes applied!');
  }
}

main().catch(console.error);

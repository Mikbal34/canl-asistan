/**
 * Update industry_presets first_message to include name question
 * This ensures DB-level backup even if runtime append is skipped
 */
const { createClient } = require('@supabase/supabase-js');
const config = require('../src/config/env');

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

const NAME_QUESTION_TR = 'Size yardımcı olabilmem için önce adınızı öğrenebilir miyim?';

async function updatePresetFirstMessages() {
  // Fetch all presets
  const { data: presets, error } = await supabase
    .from('industry_presets')
    .select('id, industry, config_tr, config_en, config_de');

  if (error) {
    console.error('Error fetching presets:', error);
    process.exit(1);
  }

  console.log(`Found ${presets.length} presets to check\n`);

  for (const preset of presets) {
    const updates = {};

    // Check config_tr
    if (preset.config_tr?.first_message) {
      const msg = preset.config_tr.first_message;
      if (!msg.includes('adınız') && !msg.includes('isminiz')) {
        // Replace generic ending with name question
        const newMsg = `Merhaba! {FIRMA_ADI}'dan {ASISTAN_ADI} ben. ${NAME_QUESTION_TR}`;
        updates.config_tr = { ...preset.config_tr, first_message: newMsg };
        console.log(`[${preset.industry}] config_tr updated:`);
        console.log(`  OLD: ${msg}`);
        console.log(`  NEW: ${newMsg}\n`);
      } else {
        console.log(`[${preset.industry}] config_tr already has name question, skipping`);
      }
    }

    // Check config_en
    if (preset.config_en?.first_message) {
      const msg = preset.config_en.first_message;
      if (!msg.includes('name')) {
        const newMsg = `Hello! I'm {ASISTAN_ADI} from {FIRMA_ADI}. May I have your name so I can assist you?`;
        updates.config_en = { ...preset.config_en, first_message: newMsg };
        console.log(`[${preset.industry}] config_en updated:`);
        console.log(`  OLD: ${msg}`);
        console.log(`  NEW: ${newMsg}\n`);
      } else {
        console.log(`[${preset.industry}] config_en already has name question, skipping`);
      }
    }

    // Check config_de
    if (preset.config_de?.first_message) {
      const msg = preset.config_de.first_message;
      if (!msg.includes('Name') && !msg.includes('namen')) {
        const newMsg = `Hallo! Ich bin {ASISTAN_ADI} von {FIRMA_ADI}. Darf ich zunächst Ihren Namen erfahren?`;
        updates.config_de = { ...preset.config_de, first_message: newMsg };
        console.log(`[${preset.industry}] config_de updated:`);
        console.log(`  OLD: ${msg}`);
        console.log(`  NEW: ${newMsg}\n`);
      } else {
        console.log(`[${preset.industry}] config_de already has name question, skipping`);
      }
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('industry_presets')
        .update(updates)
        .eq('id', preset.id);

      if (updateError) {
        console.error(`Error updating preset ${preset.industry}:`, updateError);
      } else {
        console.log(`[${preset.industry}] DB updated successfully!\n`);
      }
    }
  }

  console.log('\nDone! All preset first_messages checked and updated.');
}

updatePresetFirstMessages().catch(console.error);

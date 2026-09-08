import { Markup } from 'telegraf';

export function adminPanelKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🖼 Startup Image', 'admin:image')],
    [Markup.button.callback('✏️ Startup Message', 'admin:message')],
    [Markup.button.callback('🔘 Buttons', 'admin:buttons')],
    [Markup.button.callback('👀 Preview', 'admin:preview')],
    [Markup.button.callback('⚙️ Settings', 'admin:settings')],
  ]);
}

export function backToAdminKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'admin:back')]]);
}

export function buttonsMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Add Button', 'admin:buttons:add')],
    [Markup.button.callback('🗑 Clear All Buttons', 'admin:buttons:clear')],
    [Markup.button.callback('⬅️ Back', 'admin:back')],
  ]);
}

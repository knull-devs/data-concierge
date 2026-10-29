const CATEGORY_SETTING = Object.freeze({
  introduction: 'introduction_updates',
  message: 'message_updates',
  date_plan: 'date_updates',
  system: null,
  security: null
});

export function normalizeNotificationHref(value) {
  if (typeof value !== 'string') return '/dashboard.html';
  const href = value.trim();
  if (!href.startsWith('/') || href.startsWith('//') || href.length > 260 || /[\r\n\\]/.test(href)) return '/dashboard.html';
  return href;
}

// Notifications are a convenience layer, so an unavailable notification table
// must never turn a successful introduction/message/date operation into a failure.
export async function createNotificationBestEffort(sql, userId, notification) {
  try {
    const category = ['introduction', 'message', 'date_plan', 'system', 'security'].includes(notification?.category)
      ? notification.category : 'system';
    const prefColumn = CATEGORY_SETTING[category];
    const settingsRows = await sql`
      SELECT in_app_notifications, introduction_updates, message_updates, date_updates
      FROM dc_member_settings WHERE user_id = ${userId} LIMIT 1
    `;
    const settings = settingsRows[0];
    if (settings && settings.in_app_notifications === false) return false;
    if (settings && prefColumn && settings[prefColumn] === false) return false;
    const title = String(notification?.title || 'Date Concierge update').trim().slice(0, 120);
    const body = String(notification?.body || '').trim().slice(0, 360);
    const href = normalizeNotificationHref(notification?.href);
    const relatedId = typeof notification?.relatedId === 'string' ? notification.relatedId : null;
    await sql`
      INSERT INTO dc_notifications (user_id, category, title, body, href, related_id)
      VALUES (${userId}, ${category}, ${title || 'Date Concierge update'}, ${body}, ${href}, ${relatedId})
    `;
    return true;
  } catch (error) {
    console.warn('Notification could not be created:', error?.code || error?.name || 'unknown');
    return false;
  }
}

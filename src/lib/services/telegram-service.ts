/**
 * Telegram Bot API Service
 * Direct integration with Telegram Bot API (no third-party library needed)
 * Documentation: https://core.telegram.org/bots/api
 *
 * Note: Uses phone numbers as chat identifiers. The bot must have received
 * at least one message from the user for sending to work.
 */

export interface SendTelegramParams {
  chatId: string; // User's phone number (e.g., "+1234567890") or Telegram chat ID
  text: string; // Message text (supports HTML formatting)
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

export interface TelegramResponse {
  success: boolean;
  messageId?: number;
  error?: string;
  errorCode?: number;
}

/**
 * Send a message via Telegram Bot API
 * @param params - Message parameters (chatId, text, parseMode)
 * @param botToken - Bot token from @BotFather
 * @returns Response with success status and message ID or error
 */
export async function sendTelegramMessage(
  params: SendTelegramParams,
  botToken: string
): Promise<TelegramResponse> {
  try {
    if (!botToken) {
      return {
        success: false,
        error: 'Bot token is required',
      };
    }

    if (!params.chatId) {
      return {
        success: false,
        error: 'Chat ID is required',
      };
    }

    if (!params.text) {
      return {
        success: false,
        error: 'Message text is required',
      };
    }

    // Call Telegram Bot API
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: params.chatId,
          text: params.text,
          parse_mode: params.parseMode || 'HTML',
        }),
      }
    );

    const data = await response.json();

    if (data.ok) {
      return {
        success: true,
        messageId: data.result?.message_id,
      };
    } else {
      return {
        success: false,
        error: data.description || 'Failed to send message',
        errorCode: data.error_code,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify a Telegram bot token by calling getMe API
 * @param botToken - Bot token from @BotFather
 * @returns Bot info if valid, or error
 */
export async function verifyTelegramBot(
  botToken: string
): Promise<{
  success: boolean;
  botUsername?: string;
  botName?: string;
  error?: string;
}> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getMe`,
      {
        method: 'GET',
      }
    );

    const data = await response.json();

    if (data.ok && data.result) {
      return {
        success: true,
        botUsername: data.result.username,
        botName: data.result.first_name,
      };
    } else {
      return {
        success: false,
        error: data.description || 'Invalid bot token',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Format a message with HTML for Telegram
 * Supports: <b>bold</b>, <i>italic</i>, <u>underline</u>, <code>code</code>, <pre>pre</pre>
 * @param text - Plain or HTML text
 * @returns Properly escaped HTML for Telegram
 */
export function formatTelegramHTML(text: string): string {
  // Telegram supports basic HTML tags
  // We just need to ensure special characters are escaped if not already in HTML tags
  return text
    .replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;')
    .replace(/<(?!\/?[bius]|\/?(code|pre|a)[\s>])/g, '&lt;');
}

/**
 * Replace template variables in message text
 * @param template - Message template with variables like {{tenantName}}
 * @param variables - Object with variable values
 * @returns Message with variables replaced
 */
export function replaceTelegramVariables(
  template: string,
  variables: Record<string, string | number | undefined>
): string {
  let message = template;

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    message = message.replace(regex, String(value || ''));
  });

  return message;
}

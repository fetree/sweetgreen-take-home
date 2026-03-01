import { Injectable, Logger } from '@nestjs/common';

export type AlertSeverity = 'warning' | 'critical';

/**
 * Mock alerting service.
 *
 * In production this would POST to a Slack webhook, PagerDuty, or similar.
 * For now it writes a formatted message to stdout so the behaviour is visible
 * during development without any external dependencies.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  warn(message: string, context?: Record<string, unknown>): void {
    this.send('warning', message, context);
  }

  critical(message: string, context?: Record<string, unknown>): void {
    this.send('critical', message, context);
  }

  private send(severity: AlertSeverity, message: string, context?: Record<string, unknown>): void {
    const payload = {
      severity,
      message,
      timestamp: new Date().toISOString(),
      ...(context && { context }),
    };

    // Mock Slack block — easy to grep in logs and replace with a real webhook call
    console.log(`\n[SLACK ALERT] ${JSON.stringify(payload, null, 2)}\n`);

    if (severity === 'critical') {
      this.logger.error(`[ALERT] ${message}`, JSON.stringify(context));
    } else {
      this.logger.warn(`[ALERT] ${message}`, JSON.stringify(context));
    }
  }
}

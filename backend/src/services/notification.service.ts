/// <reference types="node" />
import nodemailer from 'nodemailer';
import { prisma } from '../index.js';
import axios from 'axios';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export class NotificationService {
    async notifyDeployment(deploymentId: string, status: 'success' | 'failure' | 'pr_preview') {
        const deployment = await prisma.deployment.findUnique({
            where: { id: deploymentId },
            include: { team: { include: { members: { include: { user: { include: { notifications: true } } } } } } }
        });
        if (!deployment) return;

        const members = deployment.team?.members || [];

        for (const member of members) {
            const settings = member.user.notifications[0];
            if (!settings) continue;

            const shouldNotify =
                (status === 'success' && settings.onSuccess) ||
                (status === 'failure' && settings.onFailure) ||
                (status === 'pr_preview' && settings.onPrPreview);

            if (!shouldNotify) continue;

            const subject = this.getSubject(deployment.name, status);
            const body = this.getBody(deployment.name, status, deployment.liveUrl);

            if (settings.emailEnabled && process.env.SMTP_USER) {
                await this.sendEmail(member.user.email, subject, body).catch(console.error);
            }

            if (settings.slackWebhook) {
                await this.sendSlack(settings.slackWebhook, subject, body).catch(console.error);
            }
        }
    }

    private async sendEmail(to: string, subject: string, text: string) {
        await transporter.sendMail({
            from: `"Rimble" <${process.env.SMTP_USER}>`,
            to,
            subject,
            text,
        });
    }

    private async sendSlack(webhookUrl: string, title: string, text: string) {
        await axios.post(webhookUrl, {
            blocks: [
                { type: 'header', text: { type: 'plain_text', text: title } },
                { type: 'section', text: { type: 'mrkdwn', text } }
            ]
        });
    }

    private getSubject(name: string, status: string): string {
        const map: Record<string, string> = {
            success: `✅ Deployment successful: ${name}`,
            failure: `❌ Deployment failed: ${name}`,
            pr_preview: `🔍 PR Preview ready: ${name}`,
        };
        return map[status] || `Deployment update: ${name}`;
    }

    private getBody(name: string, status: string, liveUrl?: string | null): string {
        let msg = `Your deployment "${name}" ${status === 'success' ? 'is now live' : status === 'failure' ? 'has failed' : 'preview is ready'}.`;
        if (liveUrl) msg += `\n\nURL: ${liveUrl}`;
        return msg;
    }

    async updateSettings(userId: string, settings: {
        emailEnabled?: boolean;
        slackWebhook?: string | null;
        onSuccess?: boolean;
        onFailure?: boolean;
        onPrPreview?: boolean;
    }) {
        return prisma.notificationSetting.upsert({
            where: { userId },
            update: settings,
            create: { userId, ...settings },
        });
    }
}

export const notificationService = new NotificationService();

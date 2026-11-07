import { useRouter } from 'expo-router';

import { canRead, currentRole } from '@/books/sync';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/txt';
import { Button, Card, IconBadge, Row, SectionHeader } from '@/components/ui';
import { business } from '@/data/live';
import { useTheme } from '@/hooks/use-theme';
import { signOut, useSession } from '@/lib/session';

const REPORTS = [
  { id: 'pl', title: 'Profit and loss', sub: 'Statement of income', ios: 'chart.line.uptrend.xyaxis', md: 'trending_up', owner: true },
  { id: 'bs', title: 'Balance sheet', sub: 'Statement of financial position', ios: 'building.columns', md: 'savings', owner: true },
  { id: 'ar', title: 'AR aging', sub: 'Unpaid invoices by days past due', ios: 'clock', md: 'schedule', owner: false },
] as const;

const ROLE_LABEL = { owner: 'Owner', ar: 'Accounts receivable', ap: 'Accounts payable' } as const;

export default function ReportsScreen() {
  const t = useTheme();
  const router = useRouter();
  const session = useSession();
  const role = currentRole();
  const shown = REPORTS.filter((r) => (r.owner ? role === 'owner' : canRead('invoices')));

  return (
    <Screen title="Reports">
      {shown.length > 0 ? (
        <>
          <Txt variant="body" color="textSecondary">
            Read-only, straight from your books. Full statements, exports and BIR forms are in the web app.
          </Txt>
          <SectionHeader title="Financial statements" />
          <Card padded={false}>
            {shown.map((r, i) => (
              <Row
                key={r.id}
                last={i === shown.length - 1}
                onPress={() => router.push({ pathname: '/report/[id]', params: { id: r.id } })}
                leading={
                  <IconBadge>
                    <Icon ios={r.ios} md={r.md} size={18} color={t.accent} />
                  </IconBadge>
                }
                title={r.title}
                subtitle={r.sub}
                trailing={<Icon ios="chevron.right" md="chevron_right" size={16} color={t.textSecondary} />}
              />
            ))}
          </Card>
        </>
      ) : (
        <Card>
          <Txt variant="body" color="textSecondary">Reports aren’t part of your role in this business.</Txt>
        </Card>
      )}

      <SectionHeader title="Account" />
      <Card padded={false}>
        <Row title={business().name} subtitle={ROLE_LABEL[role]} />
        <Row title={session.status === 'signedOut' || session.status === 'starting' ? '—' : session.email ?? 'Signed in with a phone code'} subtitle="Signed in as" last />
      </Card>
      <Button label="Sign out of this phone" kind="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}

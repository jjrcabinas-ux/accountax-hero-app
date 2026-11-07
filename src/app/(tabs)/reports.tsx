import { useRouter } from 'expo-router';

import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/txt';
import { Card, IconBadge, Row, SectionHeader } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

const REPORTS = [
  { id: 'pl', title: 'Profit and loss', sub: 'Statement of income — sales less expenses', ios: 'chart.line.uptrend.xyaxis', md: 'trending_up' },
  { id: 'bs', title: 'Balance sheet', sub: 'Statement of financial position', ios: 'building.columns', md: 'savings' },
  { id: 'ar', title: 'AR aging', sub: 'Unpaid invoices by days past due', ios: 'clock', md: 'schedule' },
] as const;

export default function ReportsScreen() {
  const t = useTheme();
  const router = useRouter();
  return (
    <Screen title="Reports">
      <Txt variant="body" color="textSecondary">
        Read-only views of your books. Full statements, exports and BIR forms stay on the web app.
      </Txt>
      <SectionHeader title="Financial statements" />
      <Card padded={false}>
        {REPORTS.map((r, i) => (
          <Row
            key={r.id}
            last={i === REPORTS.length - 1}
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
    </Screen>
  );
}

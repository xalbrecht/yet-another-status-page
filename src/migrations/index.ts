import * as migration_20260112_063824 from './20260112_063824';
import * as migration_20260112_163613_split_email_sms_settings from './20260112_163613_split_email_sms_settings';
import * as migration_20260516_125650_add_maintenance_retention from './20260516_125650_add_maintenance_retention';
import * as migration_20260731_171745_add_api_key_strategy from './20260731_171745_add_api_key_strategy';
import * as migration_20260821_192600_add_localization_settings from './20260821_192600_add_localization_settings';
import * as migration_20261110_150700_add_lagebild from './20261110_150700_add_lagebild';
import * as migration_20261110_170500_add_users_reset_password_requested_at from './20261110_170500_add_users_reset_password_requested_at';
import * as migration_20261110_180000_add_lagebild_period_days from './20261110_180000_add_lagebild_period_days';
import * as migration_20261110_190000_add_group_icons from './20261110_190000_add_group_icons';
import * as migration_20261110_190100_set_group_icons from './20261110_190100_set_group_icons';
import * as migration_20261110_200000_add_lagebild_bar_hours from './20261110_200000_add_lagebild_bar_hours';
import * as migration_20261111_100000_add_subscriber_confirmation from './20261111_100000_add_subscriber_confirmation';
import * as migration_20261112_100000_add_availability_target_and_event_source from './20261112_100000_add_availability_target_and_event_source';
import * as migration_20261112_100100_backfill_status_events from './20261112_100100_backfill_status_events';
import * as migration_20261112_200000_add_incident_availability_class from './20261112_200000_add_incident_availability_class';
import * as migration_20261113_100000_add_report_recipients from './20261113_100000_add_report_recipients';
import * as migration_20261113_200000_add_status_box_settings from './20261113_200000_add_status_box_settings';

export const migrations = [
  {
    up: migration_20260112_063824.up,
    down: migration_20260112_063824.down,
    name: '20260112_063824',
  },
  {
    up: migration_20260112_163613_split_email_sms_settings.up,
    down: migration_20260112_163613_split_email_sms_settings.down,
    name: '20260112_163613_split_email_sms_settings',
  },
  {
    up: migration_20260516_125650_add_maintenance_retention.up,
    down: migration_20260516_125650_add_maintenance_retention.down,
    name: '20260516_125650_add_maintenance_retention',
  },
  {
    up: migration_20260731_171745_add_api_key_strategy.up,
    down: migration_20260731_171745_add_api_key_strategy.down,
    name: '20260731_171745_add_api_key_strategy'
  },
  {
    up: migration_20260821_192600_add_localization_settings.up,
    down: migration_20260821_192600_add_localization_settings.down,
    name: '20260821_192600_add_localization_settings',
  },
  {
    up: migration_20261110_150700_add_lagebild.up,
    down: migration_20261110_150700_add_lagebild.down,
    name: '20261110_150700_add_lagebild',
  },
  {
    up: migration_20261110_170500_add_users_reset_password_requested_at.up,
    down: migration_20261110_170500_add_users_reset_password_requested_at.down,
    name: '20261110_170500_add_users_reset_password_requested_at',
  },
  {
    up: migration_20261110_180000_add_lagebild_period_days.up,
    down: migration_20261110_180000_add_lagebild_period_days.down,
    name: '20261110_180000_add_lagebild_period_days',
  },
  {
    up: migration_20261110_190000_add_group_icons.up,
    down: migration_20261110_190000_add_group_icons.down,
    name: '20261110_190000_add_group_icons',
  },
  {
    up: migration_20261110_190100_set_group_icons.up,
    down: migration_20261110_190100_set_group_icons.down,
    name: '20261110_190100_set_group_icons',
  },
  {
    up: migration_20261110_200000_add_lagebild_bar_hours.up,
    down: migration_20261110_200000_add_lagebild_bar_hours.down,
    name: '20261110_200000_add_lagebild_bar_hours',
  },
  {
    up: migration_20261111_100000_add_subscriber_confirmation.up,
    down: migration_20261111_100000_add_subscriber_confirmation.down,
    name: '20261111_100000_add_subscriber_confirmation',
  },
  {
    up: migration_20261112_100000_add_availability_target_and_event_source.up,
    down: migration_20261112_100000_add_availability_target_and_event_source.down,
    name: '20261112_100000_add_availability_target_and_event_source',
  },
  {
    up: migration_20261112_100100_backfill_status_events.up,
    down: migration_20261112_100100_backfill_status_events.down,
    name: '20261112_100100_backfill_status_events',
  },
  {
    up: migration_20261112_200000_add_incident_availability_class.up,
    down: migration_20261112_200000_add_incident_availability_class.down,
    name: '20261112_200000_add_incident_availability_class',
  },
  {
    up: migration_20261113_100000_add_report_recipients.up,
    down: migration_20261113_100000_add_report_recipients.down,
    name: '20261113_100000_add_report_recipients',
  },
  {
    up: migration_20261113_200000_add_status_box_settings.up,
    down: migration_20261113_200000_add_status_box_settings.down,
    name: '20261113_200000_add_status_box_settings',
  },
];

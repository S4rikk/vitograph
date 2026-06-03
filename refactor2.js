const fs = require('fs');
const file = 'c:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove specific imports
content = content.replace(/import DeviceWidgetCard from "\.\/DeviceWidgetCard";\n/, '');
content = content.replace(/import ManualEntryDialog from "\.\/ManualEntryDialog";\n/, '');

// Remove type imports for wearables
const typesRegex = /import type \{\n\s*MetricItem,\n\s*MetricHistoryPoint,\n\s*MetricFieldDefinition,\n\s*WearableMetrics,\n\} from "@\/types\/wearable-types";\n/;
content = content.replace(typesRegex, '');

// Remove DEFAULT_WEARABLE_METRICS
content = content.replace(/import \{ DEFAULT_WEARABLE_METRICS \} from "@\/types\/wearable-types";\n/, '');

// Remove wearable-field-defs
const defsRegex = /import \{\n\s*getSleepFields,\n\s*getCardioFields,\n\s*getBodyFields,\n\s*getMetabolicFields,\n\s*getStressFields\n\} from "@\/lib\/wearable-field-defs";\n/;
content = content.replace(defsRegex, '');

// Also remove the unused icons from lucide-react if they are no longer used (Moon, Heart, Scale, Droplets, Brain)
// They might be used in the overview tab, let's just keep them to avoid breaking it.

fs.writeFileSync(file, content);

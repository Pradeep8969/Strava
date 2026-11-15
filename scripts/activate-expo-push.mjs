// Run only after `npx expo install expo-notifications expo-device` succeeds.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
for(const name of ['expo-notifications','expo-device'])require.resolve(`${name}/package.json`);
writeFileSync(new URL('../services/push-platform.native.ts',import.meta.url),readFileSync(new URL('../integrations/expo-push.native.ts.template',import.meta.url)));
console.log('Native push adapter activated. Set EXPO_PUBLIC_PUSH_ENABLED=true, configure the real EAS project ID and create a new development build.');

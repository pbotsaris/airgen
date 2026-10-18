import {Text} from '@airgen/ui';

export function TextExample() {
  return (
    <>
      <Text as="h1" variant="title" bold>
        Projects
      </Text>
      <Text variant="heading">Active work</Text>
      <Text>Choose a project to continue.</Text>
      <Text variant="muted">Updated today</Text>
      <Text as="span" padAs="sm">
        Aligned with small controls
      </Text>
    </>
  );
}

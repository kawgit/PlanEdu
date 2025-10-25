import { useState } from 'react';
import {
  Container,
  Title,
  Text,
  Button,
  TextInput,
  Card,
  Badge,
  Group,
  Stack,
  Paper,
} from '@mantine/core';

function App() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');

  return (
    <Container size="md" py={40}>
      <Stack gap="xl">
        <Paper shadow="xs" p="xl" radius="md">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Title order={1}>Mantine is Working! 🎉</Title>
              <Badge size="lg" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                v8.3.5
              </Badge>
            </Group>
            <Text c="dimmed">
              Your Mantine setup is configured correctly and all components are rendering properly.
            </Text>
          </Stack>
        </Paper>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={2}>Interactive Components</Title>
            
            <Group grow>
              <TextInput
                label="Your name"
                placeholder="Enter your name"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </Group>

            {name && (
              <Text size="lg" fw={500}>
                Hello, {name}! 👋
              </Text>
            )}

            <Group justify="center" mt="md">
              <Button variant="filled" onClick={() => setCount(count + 1)}>
                Count: {count}
              </Button>
              <Button variant="light" onClick={() => setCount(0)}>
                Reset
              </Button>
            </Group>
          </Stack>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={2}>Button Variants</Title>
            <Group>
              <Button variant="filled">Filled</Button>
              <Button variant="light">Light</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="subtle">Subtle</Button>
              <Button variant="default">Default</Button>
            </Group>
          </Stack>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={2}>Badge Colors</Title>
            <Group>
              <Badge color="blue">Blue</Badge>
              <Badge color="green">Green</Badge>
              <Badge color="red">Red</Badge>
              <Badge color="yellow">Yellow</Badge>
              <Badge color="purple">Purple</Badge>
              <Badge color="gray">Gray</Badge>
            </Group>
          </Stack>
        </Card>

        <Text ta="center" c="dimmed" size="sm">
          Edit src/App.tsx to start building your application
        </Text>
      </Stack>
    </Container>
  );
}

export default App;

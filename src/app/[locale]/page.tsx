import { Container, Heading, Text } from "@/components/ui";

// Placeholder until the home page issue (#17) lands.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col justify-center py-section">
      <Container className="flex flex-col items-center gap-6 text-center">
        <Heading as="h1" size="display-xl" align="center">
          Kalbajar City
        </Heading>
        <Text size="body-lg" tone="muted">
          Kəlbəcərin ilk özəl yaşayış kompleksi
        </Text>
      </Container>
    </main>
  );
}

import logoYB from "@/components/logo.png";

export default function Head() {
  return (
    <>
      <link rel="icon" href={`${logoYB.src}?v=yb1`} type="image/png" />
      <link rel="apple-touch-icon" href={`${logoYB.src}?v=yb1`} />
      <meta name="theme-color" content="#4f46e5" />
    </>
  );
}
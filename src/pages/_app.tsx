import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "theme-ui";
import { tailwind } from "@theme-ui/presets";

const theme = {
  ...tailwind,
  colors: {
    ...tailwind.colors,
    line: "#e0e0e0",
    highlight: "rgb(255, 255, 0, 0.5)",
    mutedText: "#979797",
    primary: "#e0c3fd",
  },
};

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider theme={theme}>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}

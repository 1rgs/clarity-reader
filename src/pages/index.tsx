import { useRouter } from "next/router";
import { useState } from "react";
import { Box, Button, Flex, Grid, Heading, Input, Text } from "theme-ui";

export const DESCRIPTION = `An app for layered, depth-first reading — start with summaries, tap to
explore details, and gain clarity on complex topics.`;

const Main = () => {
  const [formUrl, setFormUrl] = useState("");
  return (
    <>
      <Flex
        sx={{
          flexDirection: "column",
          height: "100%",
          p: 2,
          width: "100%",
        }}
      >
        <Flex
          sx={{
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 3,
            p: 2,

            width: "100%",
          }}
        >
          <Box
            sx={{
              height: 100,
              width: 100,
              backgroundImage:
                "linear-gradient(120deg, #e0c3fd 0%, #8ed5fc 100%)",
              borderRadius: "50%",
              backgroundSize: "cover",
              my: 18,
              transition: "transform 244ms ease, opacity 244ms ease",
              transform: "scale(1)",
              ":hover": {
                transform: "scale(1.01)",
                opacity: ".8",
              },
            }}
          />
          <Heading as="h1" sx={{ flex: 1, display: "contents", fontSize: 60 }}>
            Clarity
          </Heading>

          <Text
            sx={{
              color: "mutedText",
              mb: 5,
              maxWidth: 600,
              textAlign: "center",
              fontSize: 24,
            }}
          >
            {DESCRIPTION}
          </Text>
          <Box
            onSubmit={(e) => {
              e.preventDefault();
            }}
            as="form"
            sx={{
              px: 4,
              display: "flex",
              flexDirection: "row",
              maxWidth: 600,
              width: "100%",
              gap: 2,
            }}
          >
            <Input
              type="url"
              placeholder="Try an article URL"
              variant="reader"
              sx={{
                border: "none",
                flex: 1,
                borderBottom: "1px solid",
                borderRadius: 0,
                fontFamily: "Alice",
              }}
              value={formUrl}
              onChange={(e) => {
                setFormUrl(e.target.value);
              }}
            />
            <Button
              type="submit"
              sx={{
                ":hover": {
                  opacity: 0.8,
                },

                ":active": {
                  opacity: 0.6,
                },
              }}
            >
              →
            </Button>
          </Box>
          <Examples />
        </Flex>
      </Flex>
    </>
  );
};

const EXAMPLES = [
  {
    url: "http://paulgraham.com/ds.html",
    title: "Do Things That Don't Scale",
    site: "Paul Graham",
  },
  {
    url: "https://en.wikipedia.org/wiki/Domino's",
    title: "Domino's",
    site: "Wikipedia",
  },
  {
    url: "https://www.vox.com/future-perfect/2023/4/1/23664724/baseball-artificial-intelligence-kyle-schwarber-philadelphia-phillies-moneyball-strikeout-homerun",
    title:
      "How baseball’s analytics revolution is changing the game — and the players",
    site: "Vox",
  },
];

const Examples = () => {
  const router = useRouter();
  return (
    <Box
      sx={{
        px: 4,
        py: 3,
        height: "fit-content",
      }}
    >
      <Text sx={{ fontWeight: "bold", color: "mutedText" }}>
        Try an example
      </Text>
      <Grid
        sx={{
          mt: 3,
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 4,
        }}
      >
        {EXAMPLES.map((example) => (
          <Flex
            onClick={() => {
              // TODO: navigate to the URL
              router.push(`/read/${example.url}`);
            }}
            key={example.url}
            sx={{
              height: "100%",
              p: 3,
              boxShadow:
                "0px 0px 1px rgba(0, 0, 0, 0.15), 0px 8px 16px rgba(0, 0, 0, 0.08)",

              cursor: "pointer",
              transition: "box-shadow 0.2s ease-in-out",
              ":hover": {
                boxShadow:
                  "0px 0px 1px rgba(0, 0, 0, 0.15), 0px 16px 32px rgba(0, 0, 0, 0.08)",
              },
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Heading key={example.url} sx={{}}>
              {example.title}
            </Heading>
            <Text
              as="div"
              sx={{
                mt: 2,
                color: "mutedText",
              }}
            >
              {example.site}
            </Text>
          </Flex>
        ))}
      </Grid>
    </Box>
  );
};

export default Main;

import { FlattenedTree, getFlattenedSummaryTree } from "@/getSummary";
import { OverlappingCards } from "@/OverlappingCards";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Box, Flex, Grid, Heading, Spinner, Text } from "theme-ui";
import { Article } from "../api/get-content";
import { useMediaQuery } from "react-responsive";

const Reader = () => {
  const router = useRouter();

  const url = router.asPath.replace("/read/", "");

  const [pageData, setPageData] = useState<null | {
    article: Article;
    flatSummary: FlattenedTree | null;
  }>(null);

  useEffect(() => {
    if (!url || typeof url !== "string") {
      router.push("/");
      return;
    }

    if (url.includes("...url")) {
      return;
    }

    fetch(`/api/get-content?${url ? `url=${encodeURIComponent(url)}` : ""}`, {
      method: "POST",
    })
      .then((res) => res.json() as Promise<{ article: Article }>)
      .then((data) => {
        setPageData({
          article: data.article,
          flatSummary: null,
        });

        console.log("article", {
          article: data.article,
        });

        getFlattenedSummaryTree(data.article.textContent.trim()).then(
          (summaryTree) => {
            setPageData((pageData) => {
              if (!pageData) {
                return null;
              }
              return {
                ...pageData,
                flatSummary: summaryTree.flattened_tree,
              };
            });
          }
        );
      })

      .catch((err) => {
        console.error(err);
      });
  }, [router, url]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isMobile = useMediaQuery({ maxWidth: 768 });

  return (
    <>
      <Flex
        sx={{
          flexDirection: "column",
          height: "100%",
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.3s",
        }}
      >
        {isMobile ? (
          <Box
            sx={{
              position: "fixed",
              top: 0,
              left: 0,

              width: "100%",
              height: "100%",
              backgroundColor: "background",
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              p: 3,
            }}
          >
            <Text sx={{ fontSize: 24, color: "mutedText" }}>
              Clarity is not yet optimized for mobile. Please visit on a
              desktop.
            </Text>
          </Box>
        ) : url ? (
          <>
            <Heading
              as="h2"
              sx={{
                px: 4,
                py: 3,
                borderBottom: "1px solid",
                borderColor: "line",
              }}
            >
              <Flex
                sx={{
                  flexDirection: "row",
                  gap: 3,
                }}
              >
                <Box
                  onClick={() => {
                    router.push("/");
                  }}
                  sx={{
                    cursor: "pointer",
                    ":hover": {
                      textDecoration: "underline",
                    },
                  }}
                >
                  ←
                </Box>

                <Box
                  onClick={() => {
                    url && window.open(url, "_blank");
                  }}
                  sx={{
                    cursor: "pointer",
                    ":hover": {
                      textDecoration: "underline",
                    },
                  }}
                >
                  {pageData?.article && pageData.article.title}
                </Box>
              </Flex>
            </Heading>
            {pageData?.flatSummary ? (
              <Box sx={{ flex: 1, display: "contents" }}>
                <OverlappingCards cardData={pageData?.flatSummary} />
              </Box>
            ) : (
              <LoadingScreen />
            )}
          </>
        ) : null}
      </Flex>
    </>
  );
};

const LOADING_COPY = [
  "Loading summaries...",
  "Crunching numbers...",
  "Creating embeddings...",
  "Solving the traveling salesman problem...",
  "Performing a linear regression...",
  "Photoshopping your face onto a cat...",
  "Photosynthesizing...",
];

const LoadingScreen = () => {
  const [loadingCopy, setLoadingCopy] = useState(LOADING_COPY[0]);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setLoadingCopy(LOADING_COPY[i++ % LOADING_COPY.length]);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Grid
      sx={{
        placeItems: "center",
        height: "100%",
      }}
    >
      <Flex
        sx={{
          flexDirection: "column",
          gap: 3,
          alignItems: "center",
        }}
      >
        <Spinner size={28} />
        <Text>{loadingCopy}</Text>
      </Flex>
    </Grid>
  );
};

export default Reader;

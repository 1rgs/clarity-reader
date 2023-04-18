/** @jsxImportSource theme-ui */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Box, Flex } from "theme-ui";
import { FlattenedTree, getSimilarity } from "./getSummary";
import { nanoid } from "nanoid";

const OverlappingCard = ({
  className,
  onClick,
  highlightedIndex,
  card,
  cardIndex,
  cards,
  setHighlightedIndex,
  highlightedRequestRef,
}: {
  className?: string;
  onClick?: () => void;
  highlightedRequestRef: React.MutableRefObject<string | null>;
  card: FlattenedTree[number];
  highlightedIndex: {
    cardIndex: number;
    sectionIndex: number;
    sentenceIndex: number | undefined;
    scrollTo: boolean;
  } | null;
  cardIndex: number;
  cards: FlattenedTree;
  setHighlightedIndex: React.Dispatch<
    React.SetStateAction<{
      cardIndex: number;
      sectionIndex: number;
      sentenceIndex: number | undefined;
      scrollTo: boolean;
    } | null>
  >;
}) => {
  const multiRef = useRef<(HTMLDivElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const onSentenceHover = useCallback(
    async (
      sentence: string,
      section_index: number,
      children_in_next_level: number[],
      hover: boolean
    ) => {
      if (cardIndex === cards.length - 1) {
        if (hover) {
          setHighlightedIndex({
            cardIndex,
            sectionIndex: section_index,
            sentenceIndex: undefined,
            scrollTo: false,
          });
        }
        return;
      }

      const nextLevelTexts = children_in_next_level.map(
        (childIndex) => cards[cardIndex + 1][childIndex]
      );

      const currentHighlightedIndex = nanoid();
      highlightedRequestRef.current = currentHighlightedIndex;

      const { targetIndex, sentenceIndex } = await getSimilarity(
        sentence,
        nextLevelTexts.map((card) => card.text)
      );

      if (currentHighlightedIndex !== highlightedRequestRef.current) return;

      const remappedIndex = targetIndex + children_in_next_level[0];
      setHighlightedIndex({
        cardIndex: cardIndex + 1,
        sectionIndex: remappedIndex,
        sentenceIndex,
        scrollTo: !hover,
      });
    },
    [cardIndex, cards, highlightedRequestRef, setHighlightedIndex]
  );

  return (
    <Box
      className={className}
      ref={scrollContainerRef}
      onClick={onClick}
      sx={{
        p: 3,
        overflowY: "auto",
        transition: "opacity 0.2s",
      }}
    >
      <pre
        sx={{
          whiteSpace: "pre-wrap",
          fontFamily: "Alice",
        }}
      >
        {card.map(
          (
            { text, children_in_next_level, sentence_indices },
            section_index
          ) => (
            <Box
              ref={(el) => {
                multiRef.current[section_index] = el;
              }}
              key={section_index}
              sx={{
                cursor: "pointer",
                borderBottom: "1px dashed",
                borderColor: "#e0e0e0",
                p: 3,
                color: highlightedIndex
                  ? highlightedIndex.cardIndex === cardIndex &&
                    highlightedIndex.sectionIndex === section_index
                    ? "text"
                    : highlightedIndex?.cardIndex > cardIndex
                    ? "text"
                    : "line"
                  : "text",

                transition: "color 0.2s",
              }}
            >
              <SplitSentence
                scrollParentIntoView={() => {
                  const scrollTop = multiRef.current[section_index]?.offsetTop;
                  const height = multiRef.current[section_index]?.clientHeight;
                  if (
                    height &&
                    scrollTop &&
                    scrollContainerRef.current &&
                    scrollContainerRef.current.scrollTop <= scrollTop &&
                    scrollContainerRef.current.scrollTop +
                      scrollContainerRef.current.clientHeight >=
                      scrollTop + height
                  )
                    return;
                  scrollContainerRef.current?.scrollTo({
                    top: scrollTop,
                    behavior: "smooth",
                  });
                }}
                text={text}
                sentence_indices={sentence_indices}
                highlightedSentenceIndex={
                  highlightedIndex?.cardIndex === cardIndex &&
                  highlightedIndex?.sectionIndex === section_index
                    ? highlightedIndex?.sentenceIndex
                    : undefined
                }
                scrollTo={
                  highlightedIndex?.cardIndex === cardIndex &&
                  highlightedIndex?.sectionIndex === section_index &&
                  highlightedIndex.scrollTo
                }
                onSentenceClick={(sentence: string) => {
                  onSentenceHover(
                    sentence,
                    section_index,
                    children_in_next_level,
                    false
                  );
                }}
                onSentenceHover={(sentence) =>
                  onSentenceHover(
                    sentence,
                    section_index,
                    children_in_next_level,
                    true
                  )
                }
              />
            </Box>
          )
        )}
      </pre>
    </Box>
  );
};

const CARD_WIDTH = 500;
const OVERLAP = 24;

export const OverlappingCards = ({ cardData }: { cardData: FlattenedTree }) => {
  const cards = cardData;
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const handleScroll = useCallback(
    (e: any) => setScrollPosition(e.target.scrollLeft),
    [setScrollPosition]
  );

  const calculatedLeftPositions: [number, number][] = useMemo(() => {
    return cards.map((_, index) => {
      const leftPosition = index * CARD_WIDTH - scrollPosition;
      const minLeftPosition = OVERLAP * index;
      return [leftPosition, minLeftPosition];
    });
  }, [cards, scrollPosition]);

  const [highlightedIndex, setHighlightedIndex] = useState<{
    cardIndex: number;
    sectionIndex: number;
    sentenceIndex: number | undefined;
    scrollTo: boolean;
  } | null>(null);

  const highlightedRequestRef = useRef<string | null>(null);

  return (
    <Box
      sx={{
        position: "relative",
        overflowX: "scroll",
        width: "100%",
        height: "100%",
      }}
      ref={scrollContainer}
      onScroll={handleScroll}
    >
      <Flex
        sx={{
          position: "sticky",
          top: 0,
          left: 0,
          height: "100%",
          width: `calc(${
            (cards.length - 1) * (CARD_WIDTH - OVERLAP)
          }px + 100%)`,
        }}
      >
        {cards.map((card, index) => {
          const [leftPosition, minLeftPosition] =
            calculatedLeftPositions[index];

          const isOverlappingThePreviousCard =
            index > 0 &&
            calculatedLeftPositions[index - 1][0] <
              calculatedLeftPositions[index - 1][1];

          const isNextCardAlmostFullyOverlapping =
            index < cards.length - 1 &&
            calculatedLeftPositions[index + 1][0] -
              calculatedLeftPositions[index + 1][1] <
              OVERLAP * 2;

          const isCardFullyVisible =
            leftPosition + CARD_WIDTH - OVERLAP < window.innerWidth;

          const shouldSnap = leftPosition <= minLeftPosition;

          return (
            <OverlappingCard
              highlightedRequestRef={highlightedRequestRef}
              key={index}
              sx={{
                flexShrink: 0,
                width: `${CARD_WIDTH}px`,
                ...(shouldSnap
                  ? { position: "sticky", left: minLeftPosition }
                  : {}),
                boxShadow: isOverlappingThePreviousCard
                  ? "-8px 0 10px -10px #e0e0e0"
                  : "none",
                borderLeft: "1px solid",
                borderColor: !isOverlappingThePreviousCard
                  ? "line"
                  : "transparent",
                zIndex: index * 2,
                backgroundColor: "white",
                opacity: isNextCardAlmostFullyOverlapping
                  ? 0
                  : !isCardFullyVisible && highlightedIndex?.cardIndex !== index
                  ? 0.4
                  : 1,
              }}
              card={card}
              cardIndex={index}
              cards={cards}
              setHighlightedIndex={setHighlightedIndex}
              highlightedIndex={highlightedIndex ?? null}
            />
          );
        })}
      </Flex>
    </Box>
  );
};

const SplitSentence = ({
  text,
  sentence_indices,
  onSentenceClick,
  onSentenceHover,
  highlightedSentenceIndex,
  scrollTo,
  scrollParentIntoView,
}: {
  text: string;
  sentence_indices: [number, number][];
  onSentenceClick: (sentence: string) => void;
  onSentenceHover: (sentence: string, index: number) => void;
  highlightedSentenceIndex?: number;
  scrollTo?: boolean;
  scrollParentIntoView: () => void;
}) => {
  const [hoveredSentenceIndex, setHoveredSentenceIndex] = useState(-1);

  const sentenceSpanRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (highlightedSentenceIndex === undefined || !scrollTo) return;
    const el = sentenceSpanRefs.current[highlightedSentenceIndex];
    if (!el) return;

    scrollParentIntoView();
  }, [highlightedSentenceIndex, scrollTo, scrollParentIntoView]);
  const timeoutRef = useRef<number | null>(null);
  const sentenceSpans = useMemo(() => {
    return sentence_indices.flatMap(([start, end], index) => {
      const sentence = text.slice(start, end);
      return [
        <span
          key={index}
          ref={(el) => {
            if (!el) return;
            sentenceSpanRefs.current[index] = el;
          }}
          sx={{
            textDecoration:
              hoveredSentenceIndex === index ? "underline" : "none",

            cursor: "pointer",

            ...(highlightedSentenceIndex === index
              ? {
                  background: "highlight",
                }
              : {}),
          }}
          onMouseEnter={async () => {
            if (timeoutRef.current) {
              window.clearTimeout(timeoutRef.current);
            }
            const el = sentenceSpanRefs.current[index];

            if (!el) return;
            await new Promise((resolve) => setTimeout(resolve, 120));
            const isHovered = el.matches(":hover");

            if (isHovered) {
              setHoveredSentenceIndex(index);
              onSentenceHover(sentence, index);
            }
          }}
          onMouseLeave={() => {
            if (timeoutRef.current) {
              window.clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = window.setTimeout(() => {
              setHoveredSentenceIndex(-1);

              timeoutRef.current = null;
            }, 200);
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            hoveredSentenceIndex === index ? onSentenceClick(sentence) : null;
          }}
        >
          {sentence}
        </span>,
        <span key={`${index}-space`}> </span>,
      ];
    });
  }, [
    sentence_indices,
    text,
    hoveredSentenceIndex,
    highlightedSentenceIndex,
    onSentenceHover,
    onSentenceClick,
  ]);

  return <>{sentenceSpans}</>;
};

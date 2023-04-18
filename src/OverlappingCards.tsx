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

const OverlappingCard = ({
  className,
  onClick,
  highlightedIndex,
  card,
  cardIndex,
  cards,
  setHighlightedIndex,
}: {
  className?: string;
  onClick?: () => void;

  isCardFullyVisible?: boolean;
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
                onSentenceClick={async (sentence: string) => {
                  if (cardIndex === cards.length - 1) return;

                  const nextLevelTexts = children_in_next_level.map(
                    (childIndex) => cards[cardIndex + 1][childIndex]
                  );
                  const { targetIndex, sentenceIndex } = await getSimilarity(
                    sentence,
                    nextLevelTexts.map((card) => card.text)
                  );
                  const remappedIndex = targetIndex + children_in_next_level[0];
                  setHighlightedIndex({
                    cardIndex: cardIndex + 1,
                    sectionIndex: remappedIndex,
                    sentenceIndex,
                    scrollTo: true,
                  });
                }}
                onSentenceHover={async (sentence: string, index: number) => {
                  if (cardIndex === cards.length - 1) {
                    setHighlightedIndex({
                      cardIndex,
                      sectionIndex: section_index,
                      sentenceIndex: undefined,
                      scrollTo: false,
                    });
                  }

                  const nextLevelTexts = children_in_next_level.map(
                    (childIndex) => cards[cardIndex + 1][childIndex]
                  );

                  const currentHighlightedIndex = highlightedIndex;

                  const { targetIndex, sentenceIndex } = await getSimilarity(
                    sentence,
                    nextLevelTexts.map((card) => card.text)
                  );

                  if (
                    currentHighlightedIndex &&
                    (currentHighlightedIndex.cardIndex !==
                      highlightedIndex?.cardIndex ||
                      currentHighlightedIndex.sectionIndex !==
                        highlightedIndex?.sectionIndex)
                  ) {
                    return;
                  }

                  const remappedIndex = targetIndex + children_in_next_level[0];
                  setHighlightedIndex({
                    cardIndex: cardIndex + 1,
                    sectionIndex: remappedIndex,
                    sentenceIndex,
                    scrollTo: true,
                  });
                }}
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
          onMouseEnter={() => {
            const el = sentenceSpanRefs.current[index];

            if (!el) return;

            const isHovered = el.matches(":hover");

            if (isHovered) {
              setHoveredSentenceIndex(index);
              onSentenceHover(sentence, index);
            }
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

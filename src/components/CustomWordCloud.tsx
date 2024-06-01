"use client";
import { useTheme } from "next-themes";
import React from "react";
import D3WordCloud from "react-d3-cloud";

type Props = {};

const data = [
  {
    text: "hey",
    value: 3,
  },
  {
    text: "hi",
    value: 3,
  },
  {
    text: "lol",
    value: 7,
  },
  {
    text: "puki",
    value: 8,
  },
  {
    text: "uk",
    value: 9,
  },
];

const fontSizeMapper = (word: { value: number }) => {
  return Math.log2(word.value) * 5 + 16;
};

const CustomWordCloud = (props: Props) => {
  const theme = useTheme();
  return (
    <>
      <D3WordCloud
        height={550}
        data={data}
        font="Times"
        fontSize={fontSizeMapper}
        rotate={0}
        padding={10}
        fill={theme.theme === "dark" ? "white" : "black"}
      />
    </>
  );
};

export default CustomWordCloud;

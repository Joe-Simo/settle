"use client";

import { AllCommunityModule, ModuleRegistry, colorSchemeDarkWarm, themeQuartz } from "ag-grid-community";
import { AgGridReact, type AgGridReactProps } from "ag-grid-react";
import { forwardRef } from "react";

ModuleRegistry.registerModules([AllCommunityModule]);

/** AG Grid Community with a custom dark "backstage" theme built with the Theming API. */
export const backstageTheme = themeQuartz.withPart(colorSchemeDarkWarm).withParams({
  backgroundColor: "#1a1614",
  foregroundColor: "#f4ede4",
  accentColor: "#f5a524",
  headerBackgroundColor: "#221d1a",
  headerTextColor: "#d9cbbb",
  borderColor: "#3a312b",
  rowHoverColor: "#f5a52412",
  oddRowBackgroundColor: "#1d1917",
  selectedRowBackgroundColor: "#f5a52422",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  fontSize: 13,
  headerFontWeight: 600,
  wrapperBorderRadius: 10,
  spacing: 6,
});

export type GridProps<T> = AgGridReactProps<T> & { height?: number | string };

function GridInner<T>({ height = 320, ...props }: GridProps<T>, ref: React.ForwardedRef<AgGridReact<T>>) {
  return (
    <div style={{ height, width: "100%" }}>
      <AgGridReact<T> ref={ref} theme={backstageTheme} animateRows {...props} />
    </div>
  );
}

export const Grid = forwardRef(GridInner) as <T>(p: GridProps<T> & { ref?: React.Ref<AgGridReact<T>> }) => React.ReactElement;

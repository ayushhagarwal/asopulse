import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { motion } from "motion/react";
import { useState } from "react";
import { keywordRows, type KeywordRow } from "../../data/fixtures";
import { StarIcon } from "../../components/icons";

const column = createColumnHelper<KeywordRow>();

export function OpportunityTable() {
  const [rows, setRows] = useState(keywordRows.slice(0, 4));
  const [sorting, setSorting] = useState<SortingState>([{ id: "opportunity", desc: true }]);
  const columns = [
    column.accessor("keyword", {
      header: "Keyword",
      cell: ({ row, getValue }) => (
        <div className="keyword-cell">
          <button
            className="star-button"
            aria-label={`${row.original.tracked ? "Untrack" : "Track"} ${getValue()}`}
            onClick={() =>
              setRows((current) =>
                current.map((item) =>
                  item.id === row.original.id ? { ...item, tracked: !item.tracked } : item,
                ),
              )
            }
          >
            <StarIcon size={17} fill={row.original.tracked ? "#dff5e4" : "none"} />
          </button>
          <strong>{getValue()}</strong>
        </div>
      ),
    }),
    column.accessor("rank", { header: "Rank", cell: (info) => info.getValue() ?? ">200" }),
    column.accessor("competition", {
      header: "Competition",
      cell: (info) => <Metric value={info.getValue()} inverted />,
    }),
    column.accessor("opportunity", {
      header: "Opportunity",
      cell: (info) => <Metric value={info.getValue()} />,
    }),
    column.accessor("movement", {
      header: "Movement",
      cell: (info) => (
        <span className={info.getValue() > 0 ? "positive" : "negative"}>
          {info.getValue() > 0 ? "↑" : "↓"} {Math.abs(info.getValue())}
        </span>
      ),
    }),
  ];
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id}>
                  <button onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <span>
                      {header.column.getIsSorted() === "asc"
                        ? "↑"
                        : header.column.getIsSorted() === "desc"
                          ? "↓"
                          : "↕"}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, index) => (
            <motion.tr
              key={row.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.035 }}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ value, inverted = false }: { value: number; inverted?: boolean }) {
  const display = inverted ? 100 - value : value;
  return (
    <div className="metric">
      <span>{value}</span>
      <i>
        <b style={{ width: `${display}%` }} />
      </i>
    </div>
  );
}

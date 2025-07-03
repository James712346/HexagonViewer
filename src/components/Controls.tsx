import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Box,
    Card,
    CardContent,
    Chip,
    ClickAwayListener,
    Collapse,
    IconButton,
    InputAdornment,
    List,
    ListItem,
    Paper,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import {
    Delete as DeleteIcon,
    Download as DownloadIcon,
    Edit as EditIcon,
    Merge as MergeIcon,
    Refresh as RefreshIcon,
    Search as SearchIcon,
    Sort as SortIcon,
    SortByAlpha as SortByAlphaIcon,
    Tag as RegexIcon,
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
} from "@mui/icons-material";
import { useControls } from "react-zoom-pan-pinch";
import { clearDatabaseStorage, downloadDatabase } from "../helpers/database.ts";
import { mergeDatabases } from "../helpers/mergeDatabase.ts";
import initSqlJs, { Database } from "sql.js";
import sqliteUrl from "../assets/sql-wasm.wasm?url";

// Helper function to get date color based on proximity
const getDateColor = (dateString: string): string => {
    if (!dateString) return "";

    try {
        const date = new Date(dateString);
        const now = new Date();
        const timeDiff = date.getTime() - now.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        if (daysDiff <= 30) {
            return "#f44336"; // Red for within a month
        } else if (daysDiff <= 90) {
            return "#ff9800"; // Orange for within 3 months
        }
        return "";
    } catch (error) {
        return "";
    }
};

// Enhanced search function with regex support
const enhancedSearch = (
    query: string,
    text: string,
    useRegex: boolean,
): { match: boolean; score: number } => {
    if (!query) return { match: true, score: 1 };

    try {
        if (useRegex) {
            const regex = new RegExp(query, "i");
            const match = regex.test(text);
            return { match, score: match ? 1 : 0 };
        } else {
            // Fallback to fuzzy search
            const queryLower = query.toLowerCase();
            const textLower = text.toLowerCase();

            // Exact match gets highest score
            if (textLower.includes(queryLower)) {
                return { match: true, score: 1 };
            }

            // Fuzzy matching algorithm
            let queryIndex = 0;

            for (
                let i = 0;
                i < textLower.length && queryIndex < queryLower.length;
                i++
            ) {
                if (textLower[i] === queryLower[queryIndex]) {
                    queryIndex++;
                }
            }

            const matchRatio = queryIndex / queryLower.length;
            const lengthRatio = queryLower.length / textLower.length;

            return {
                match: matchRatio > 0.5,
                score: matchRatio * lengthRatio,
            };
        }
    } catch (error) {
        // If regex is invalid, fall back to fuzzy search
        return enhancedSearch(query, text, false);
    }
};

// Enhanced highlight function with regex support
const highlightText = (
    text: string,
    query: string,
    useRegex: boolean,
): React.ReactNode => {
    if (!query) return text;

    try {
        let regex: RegExp;

        if (useRegex) {
            regex = new RegExp(`(${query})`, "gi");
        } else {
            // Escape special regex characters for literal search
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            regex = new RegExp(`(${escapedQuery})`, "gi");
        }

        const parts = text.split(regex);

        return parts.map((part, index) =>
            regex.test(part)
                ? (
                    <span
                        key={index}
                        style={{
                            backgroundColor: "#ffeb3b",
                            fontWeight: "bold",
                        }}
                    >
                        {part}
                    </span>
                )
                : part
        );
    } catch (error) {
        // If regex is invalid, return original text
        return text;
    }
};

// Sort types
type SortType =
    | "relevance"
    | "date-asc"
    | "date-desc"
    | "alpha-asc"
    | "alpha-desc";

interface SearchItem {
    id: string;
    rooms: string;
    label: string;
    certificate_tag: string;
    forecasted_date: string;
    boards: string;
}

export const Controls: React.FC<
    {
        database: Database;
        setDatabase: (db: Database | null) => void;
        setSelectedArea: (item: string | null) => void;
    }
> = ({ database, setDatabase, setSelectedArea }) => {
    const { zoomIn, zoomOut, resetTransform } = useControls();
    const mergeFileInputRef = useRef < HTMLInputElement > (null);
    const searchContainerRef = useRef < HTMLDivElement > (null);
    const buttonsContainerRef = useRef < HTMLDivElement > (null);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [isButtonsExpanded, setIsButtonsExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [useRegex, setUseRegex] = useState(false);
    const [searchItems, setSearchItems] = useState < SearchItem[] > ([]);
    const [showResults, setShowResults] = useState(false);
    const [sortType, setSortType] = useState < SortType > ("relevance");

    // Fetch search data from database
    useEffect(() => {
        const fetchSearchData = async () => {
            if (!database) return;

            try {
                const query = `
          SELECT
            ca.id AS id,
            ca.room AS rooms,
            ca.label AS label,
            GROUP_CONCAT(DISTINCT hcd.certificate_tag) as certificate_tag,
            GROUP_CONCAT(DISTINCT hcd.forecasted_date) as scheduled_date,
            GROUP_CONCAT(DISTINCT ba.board) AS boards
          FROM clickableAreas ca
            LEFT OUTER JOIN boardsAreas ba ON ca.id = ba.clickableArea
            LEFT OUTER JOIN hexagon_dump_tasks_dump td ON td.asset_id = ba.board
            LEFT OUTER JOIN hexagon_dump_certvtask_dump ctd ON ctd.task_id = td.task_id
            LEFT OUTER JOIN hexagon_dump_cert_dump hcd ON hcd.certificate_tag = ctd.cert_id
          GROUP BY ca.id, ca.room, ca.label
          ORDER BY hcd.forecasted_date;
        `;

                const result = database.exec(query);
                if (result.length > 0) {
                    const items: SearchItem[] = result[0].values.map((
                        row: any[],
                    ) => ({
                        id: row[0] || "",
                        rooms: row[1] || "",
                        label: row[2] || "",
                        certificate_tag: row[3] || "",
                        forecasted_date: row[4] || "",
                        boards: row[5] || "",
                    }));
                    setSearchItems(items);
                }
            } catch (error) {
                console.error("Error fetching search data:", error);
            }
        };

        fetchSearchData();
    }, [database]);

    // Helper function to get the earliest scheduled date for sorting
    const getEarliestDate = (forecastedDate: string): Date => {
        if (!forecastedDate) return new Date("9999-12-31"); // Far future for items without dates

        const dates = forecastedDate.split(",").map((date) => {
            const trimmed = date.trim();
            return trimmed ? new Date(trimmed) : new Date("9999-12-31");
        });

        return new Date(Math.min(...dates.map((d) => d.getTime())));
    };

    // Filter and sort search results
    const filteredItems = useMemo(() => {
        let results = searchItems;

        // Apply search filtering
        if (searchQuery) {
            results = searchItems
                .map((item) => {
                    const searchableText =
                        `${item.rooms} ${item.label} ${item.certificate_tag} ${item.forecasted_date} ${item.boards}`;
                    const searchResult = enhancedSearch(
                        searchQuery,
                        searchableText,
                        useRegex,
                    );

                    return {
                        ...item,
                        ...searchResult,
                    };
                })
                .filter((item) => item.match);
        }

        // Apply sorting
        const sortedResults = [...results].sort((a, b) => {
            switch (sortType) {
                case "relevance":
                    if (searchQuery) {
                        return (b as any).score - (a as any).score;
                    }
                    return 0;

                case "date-asc":
                    return getEarliestDate(a.forecasted_date).getTime() -
                        getEarliestDate(b.forecasted_date).getTime();

                case "date-desc":
                    return getEarliestDate(b.forecasted_date).getTime() -
                        getEarliestDate(a.forecasted_date).getTime();

                case "alpha-asc":
                    return a.label.localeCompare(b.label);

                case "alpha-desc":
                    return b.label.localeCompare(a.label);

                default:
                    return 0;
            }
        });

        return sortedResults;
    }, [searchItems, searchQuery, useRegex, sortType]);

    // Handle sort type cycling
    const handleSortClick = () => {
        const sortOrder: SortType[] = [
            "relevance",
            "date-asc",
            "date-desc",
            "alpha-asc",
            "alpha-desc",
        ];
        const currentIndex = sortOrder.indexOf(sortType);
        const nextIndex = (currentIndex + 1) % sortOrder.length;
        setSortType(sortOrder[nextIndex]);
    };

    // Get sort icon and tooltip based on current sort type
    const getSortDisplay = () => {
        switch (sortType) {
            case "relevance":
                return { icon: <SortIcon />, tooltip: "Sort by Relevance" };
            case "date-asc":
                return {
                    icon: <SortIcon sx={{ transform: "rotate(0deg)" }} />,
                    tooltip: "Sort by Date (Earliest First)",
                };
            case "date-desc":
                return {
                    icon: <SortIcon sx={{ transform: "rotate(180deg)" }} />,
                    tooltip: "Sort by Date (Latest First)",
                };
            case "alpha-asc":
                return {
                    icon: <SortByAlphaIcon />,
                    tooltip: "Sort Alphabetically (A-Z)",
                };
            case "alpha-desc":
                return {
                    icon: (
                        <SortByAlphaIcon sx={{ transform: "rotate(180deg)" }} />
                    ),
                    tooltip: "Sort Alphabetically (Z-A)",
                };
            default:
                return { icon: <SortIcon />, tooltip: "Sort" };
        }
    };

    // Handle merge file operations
    const handleMergeFile = async () => {
        if (!database) {
            alert("No current database loaded. Please load a database first.");
            return;
        }
        mergeFileInputRef.current?.click();
    };

    const handleFileSelect = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            console.log("Loading database file for merge...");
            const SQL = await initSqlJs({ locateFile: () => sqliteUrl });

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target?.result as ArrayBuffer;
                    const data = new Uint8Array(arrayBuffer);
                    const newDb = new SQL.Database(data);

                    const confirmMerge = confirm(
                        "This will merge the uploaded database with your current database.\n\n" +
                        "• Hexagon tables from the new file will replace existing ones\n" +
                        "• Your existing non-hexagon tables (PDFs, markups, etc.) will be preserved\n\n" +
                        "Do you want to continue?",
                    );

                    if (!confirmMerge) {
                        newDb.close();
                        return;
                    }

                    console.log("Starting database merge...");
                    await mergeDatabases(database, newDb, setDatabase);

                    alert("Database merge completed successfully!");
                    console.log("Database merge completed");
                } catch (error) {
                    console.error("Error during merge:", error);
                    alert(
                        `Failed to merge database: ${error instanceof Error
                            ? error.message
                            : "Unknown error"
                        }`,
                    );
                }
            };

            reader.onerror = () => {
                alert("Failed to read the database file.");
            };

            reader.readAsArrayBuffer(file);
        } catch (error) {
            console.error("Error loading file for merge:", error);
            alert(
                `Failed to load database file: ${error instanceof Error ? error.message : "Unknown error"
                }`,
            );
        } finally {
            if (event.target) {
                event.target.value = "";
            }
        }
    };

    const handleItemClick = (item: SearchItem) => {
        console.log("Selected item:", item);
        setShowResults(false);
        setSearchQuery("");
        setSelectedArea(item.id);
        // Add your item selection logic here
    };

    const handleSearchFocus = () => {
        if (searchQuery || filteredItems.length > 0) {
            setShowResults(true);
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setShowResults(value.length > 0 || filteredItems.length > 0);
    };

    // Control button configuration
    const controlButtons = [
        {
            icon: <ZoomInIcon />,
            label: "Zoom In",
            onClick: () => zoomIn(),
            disabled: false,
        },
        {
            icon: <ZoomOutIcon />,
            label: "Zoom Out",
            onClick: () => zoomOut(),
            disabled: false,
        },
        {
            icon: <RefreshIcon />,
            label: "Reset View",
            onClick: () => resetTransform(),
            disabled: false,
        },
        {
            icon: <DownloadIcon />,
            label: "Download Database",
            onClick: () => downloadDatabase(database, "exported.sqlite"),
            disabled: false,
        },
        {
            icon: <MergeIcon />,
            label: "Merge Database",
            onClick: handleMergeFile,
            disabled: !database,
        },
        {
            icon: <EditIcon />,
            label: "Edit",
            onClick: () => console.log("EDIT"),
            disabled: false,
        },
        {
            icon: <DeleteIcon />,
            label: "Clear Storage",
            onClick: () => {
                if (confirm("Do you want to delete the local storage?")) {
                    clearDatabaseStorage(setDatabase);
                }
            },
            disabled: false,
        },
    ];

    const sortDisplay = getSortDisplay();
    return (
        <>
            {/* Search Panel - Top Left */}
            <Box
                ref={searchContainerRef}
                sx={{
                    position: "fixed",
                    top: 20,
                    left: 20,
                    zIndex: 1300,
                    pointerEvents: "none",
                }}
            >
                <ClickAwayListener
                    onClickAway={() => {
                        setIsSearchExpanded(false);
                        setShowResults(false);
                    }}
                >
                    <Paper
                        elevation={6}
                        sx={{
                            borderRadius: 3,
                            overflow: "visible",
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            width: isSearchExpanded ? "820px" : "60px",
                            pointerEvents: "auto",
                            background:
                                "linear-gradient(145deg, #ffffff 0%, #f5f5f5 100%)",
                            border: "1px solid rgba(0, 0, 0, 0.1)",
                        }}
                        onMouseEnter={() => setIsSearchExpanded(true)}
                        onMouseLeave={() => {
                            if (!showResults && !searchQuery) {
                                setIsSearchExpanded(false);
                            }
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                p: 1,
                                gap: 1,
                                minWidth: "60px",
                            }}
                        >
                            {/* Search Header */}
                            {isSearchExpanded
                                ? (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <SearchIcon
                                            sx={{ color: "primary.main" }}
                                        />
                                        <Typography
                                            variant="body2"
                                            sx={{ fontWeight: 500 }}
                                        >
                                            Search
                                        </Typography>
                                    </Box>
                                )
                                : (
                                    <Tooltip
                                        title="Search"
                                        arrow
                                        placement="right"
                                    >
                                        <IconButton
                                            sx={{
                                                color: "primary.main",
                                                alignSelf: "center",
                                                "&:hover": {
                                                    backgroundColor:
                                                        "primary.light",
                                                    color: "white",
                                                },
                                            }}
                                            onClick={() => {
                                                setIsSearchExpanded(true);
                                                setShowResults(
                                                    searchQuery.length > 0 ||
                                                    filteredItems.length >
                                                    0,
                                                );
                                            }}
                                        >
                                            <SearchIcon />
                                        </IconButton>
                                    </Tooltip>
                                )}

                            {/* Search Field and Options */}
                            <Collapse in={isSearchExpanded} unmountOnExit>
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 1,
                                    }}
                                >
                                    <TextField
                                        size="small"
                                        placeholder={useRegex
                                            ? "Enter regex pattern..."
                                            : "Search items..."}
                                        value={searchQuery}
                                        onChange={(e) =>
                                            handleSearchChange(e.target.value)}
                                        onFocus={handleSearchFocus}
                                        sx={{
                                            width: "100%",
                                            "& .MuiOutlinedInput-root": {
                                                height: "36px",
                                                fontSize: "0.875rem",
                                            },
                                        }}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <Tooltip
                                                        title={sortDisplay
                                                            .tooltip}
                                                        arrow
                                                    >
                                                        <IconButton
                                                            size="small"
                                                            onClick={handleSortClick}
                                                            sx={{
                                                                color:
                                                                    sortType ===
                                                                        "relevance"
                                                                        ? "text.secondary"
                                                                        : "primary.main",
                                                                "&:hover": {
                                                                    backgroundColor:
                                                                        "primary.light",
                                                                    color:
                                                                        "white",
                                                                },
                                                            }}
                                                        >
                                                            {sortDisplay.icon}
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip
                                                        title={useRegex
                                                            ? "Regex Mode"
                                                            : "Text Mode"}
                                                        arrow
                                                    >
                                                        <IconButton
                                                            size="small"
                                                            onClick={() =>
                                                                setUseRegex(
                                                                    !useRegex,
                                                                )}
                                                            sx={{
                                                                color: useRegex
                                                                    ? "primary.main"
                                                                    : "text.secondary",
                                                                "&:hover": {
                                                                    backgroundColor:
                                                                        "primary.light",
                                                                    color:
                                                                        "white",
                                                                },
                                                            }}
                                                        >
                                                            <RegexIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                </Box>
                            </Collapse>

                            {/* Search Results */}
                            {showResults && (
                                <Box
                                    sx={{
                                        maxHeight: "400px",
                                        overflow: "auto",
                                        backgroundColor:
                                            "rgba(255, 255, 255, 0.95)",
                                        borderRadius: 1,
                                        border: "1px solid rgba(0, 0, 0, 0.1)",
                                        width: "100%",
                                    }}
                                >
                                    <List dense sx={{ p: 0 }}>
                                        {filteredItems.length === 0
                                            ? (
                                                <ListItem sx={{ py: 2 }}>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                        align="center"
                                                        sx={{ width: "100%" }}
                                                    >
                                                        {searchQuery
                                                            ? "No matches found"
                                                            : "No items available"}
                                                    </Typography>
                                                </ListItem>
                                            )
                                            : (
                                                filteredItems.map(
                                                    (item, index) => {
                                                        // Parse certificate tags and scheduled dates
                                                        const certTags =
                                                            item.certificate_tag
                                                                ? item
                                                                    .certificate_tag
                                                                    .split(",")
                                                                    .map(
                                                                        (tag) =>
                                                                            tag.trim(),
                                                                    )
                                                                : [];
                                                        const forecastedDates =
                                                            item.forecasted_date
                                                                ? item
                                                                    .forecasted_date
                                                                    .split(",")
                                                                    .map(
                                                                        (
                                                                            date,
                                                                        ) => date
                                                                            .trim(),
                                                                    )
                                                                : [];

                                                        return (
                                                            <ListItem
                                                                key={`${item.id}-${index}`}
                                                                sx={{ p: 0.5 }}
                                                            >
                                                                <Card
                                                                    sx={{
                                                                        width:
                                                                            "100%",
                                                                        cursor:
                                                                            "pointer",
                                                                        transition:
                                                                            "all 0.2s ease",
                                                                        "&:hover":
                                                                        {
                                                                            transform:
                                                                                "translateY(-1px)",
                                                                            boxShadow:
                                                                                "0 4px 12px rgba(0, 0, 0, 0.15)",
                                                                        },
                                                                    }}
                                                                    onClick={() =>
                                                                        handleItemClick(
                                                                            item,
                                                                        )}
                                                                >
                                                                    <CardContent
                                                                        sx={{
                                                                            p: 1,
                                                                            "&:last-child":
                                                                            {
                                                                                pb: 1,
                                                                            },
                                                                        }}
                                                                    >
                                                                        <Typography
                                                                            variant="caption"
                                                                            component="h3"
                                                                            gutterBottom
                                                                        >
                                                                            {highlightText(
                                                                                item.label,
                                                                                searchQuery,
                                                                                useRegex,
                                                                            )}
                                                                        </Typography>

                                                                        <Typography
                                                                            variant="caption"
                                                                            color="text.secondary"
                                                                            gutterBottom
                                                                        >
                                                                            {highlightText(
                                                                                item.rooms,
                                                                                searchQuery,
                                                                                useRegex,
                                                                            )}
                                                                        </Typography>
                                                                        <div
                                                                            style={{
                                                                                width:
                                                                                    "100%",
                                                                                height:
                                                                                    "0px",
                                                                            }}
                                                                        />
                                                                        {/* Show each certificate with its corresponding scheduled date */}
                                                                        {certTags
                                                                            .length >
                                                                            0 &&
                                                                            (
                                                                                <Box
                                                                                    sx={{
                                                                                        mb: 0.5,
                                                                                        display:
                                                                                            "grid",
                                                                                        gridTemplateColumns:
                                                                                            "repeat(5, 1fr)",
                                                                                        gap: 0.5,
                                                                                        width:
                                                                                            "100%",
                                                                                    }}
                                                                                >
                                                                                    {certTags
                                                                                        .map(
                                                                                            (
                                                                                                certTag,
                                                                                                certIndex,
                                                                                            ) => {
                                                                                                const forecastedDate =
                                                                                                    forecastedDates[
                                                                                                    certIndex
                                                                                                    ];
                                                                                                const dateColor =
                                                                                                    getDateColor(
                                                                                                        forecastedDate,
                                                                                                    );

                                                                                                return (
                                                                                                    <Box
                                                                                                        key={certIndex}
                                                                                                        sx={{
                                                                                                            display:
                                                                                                                "flex",
                                                                                                            flexDirection:
                                                                                                                "column",
                                                                                                            alignItems:
                                                                                                                "flex-start",
                                                                                                            gap: 0.25,
                                                                                                            p: 0.5,
                                                                                                            border:
                                                                                                                "1px solid rgba(0, 0, 0, 0.1)",
                                                                                                            borderRadius:
                                                                                                                1,
                                                                                                            backgroundColor:
                                                                                                                "rgba(255, 255, 255, 0.5)",
                                                                                                            minHeight:
                                                                                                                "40px",
                                                                                                        }}
                                                                                                    >
                                                                                                        <Typography
                                                                                                            variant="caption"
                                                                                                            color="text.secondary"
                                                                                                            fontSize="0.65rem"
                                                                                                            sx={{
                                                                                                                lineHeight:
                                                                                                                    1.2,
                                                                                                                wordBreak:
                                                                                                                    "break-word",
                                                                                                                width:
                                                                                                                    "100%",
                                                                                                            }}
                                                                                                        >
                                                                                                            {highlightText(
                                                                                                                certTag,
                                                                                                                searchQuery,
                                                                                                                useRegex,
                                                                                                            )}
                                                                                                        </Typography>
                                                                                                        {forecastedDate &&
                                                                                                            (
                                                                                                                <Chip
                                                                                                                    label={highlightText(
                                                                                                                        forecastedDate,
                                                                                                                        searchQuery,
                                                                                                                        useRegex,
                                                                                                                    )}
                                                                                                                    size="small"
                                                                                                                    color={dateColor
                                                                                                                        ? "default"
                                                                                                                        : "primary"}
                                                                                                                    variant="outlined"
                                                                                                                    sx={{
                                                                                                                        height:
                                                                                                                            "14px",
                                                                                                                        fontSize:
                                                                                                                            "0.6rem",
                                                                                                                        width:
                                                                                                                            "100%",
                                                                                                                        "& .MuiChip-label":
                                                                                                                        {
                                                                                                                            px: 0.5,
                                                                                                                            overflow:
                                                                                                                                "hidden",
                                                                                                                            textOverflow:
                                                                                                                                "ellipsis",
                                                                                                                            whiteSpace:
                                                                                                                                "nowrap",
                                                                                                                        },
                                                                                                                        ...(dateColor &&
                                                                                                                        {
                                                                                                                            color:
                                                                                                                                dateColor,
                                                                                                                            borderColor:
                                                                                                                                dateColor,
                                                                                                                            backgroundColor:
                                                                                                                                `${dateColor}15`,
                                                                                                                        }),
                                                                                                                    }}
                                                                                                                />
                                                                                                            )}
                                                                                                    </Box>
                                                                                                );
                                                                                            },
                                                                                        )}
                                                                                </Box>
                                                                            )}
                                                                        {item
                                                                            .boards &&
                                                                            (
                                                                                <Typography
                                                                                    variant="caption"
                                                                                    color="text.secondary"
                                                                                    fontSize="0.65rem"
                                                                                    noWrap
                                                                                >
                                                                                    Boards:
                                                                                    {" "}
                                                                                    {highlightText(
                                                                                        item.boards,
                                                                                        searchQuery,
                                                                                        useRegex,
                                                                                    )}
                                                                                </Typography>
                                                                            )}
                                                                    </CardContent>
                                                                </Card>
                                                            </ListItem>
                                                        );
                                                    },
                                                )
                                            )}
                                    </List>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </ClickAwayListener>
            </Box>

            {/* Control Buttons Panel - Bottom Left */}
            <Box
                ref={buttonsContainerRef}
                sx={{
                    position: "fixed",
                    bottom: 20,
                    left: 20,
                    zIndex: 1300,
                    pointerEvents: "none",
                }}
            >
                <ClickAwayListener
                    onClickAway={() => setIsButtonsExpanded(false)}
                >
                    <Paper
                        elevation={6}
                        sx={{
                            borderRadius: 3,
                            overflow: "visible",
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            width: isButtonsExpanded ? "200px" : "60px",
                            pointerEvents: "auto",
                            background:
                                "linear-gradient(145deg, #ffffff 0%, #f5f5f5 100%)",
                            border: "1px solid rgba(0, 0, 0, 0.1)",
                        }}
                        onMouseEnter={() => setIsButtonsExpanded(true)}
                        onMouseLeave={() => setIsButtonsExpanded(false)}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                p: 1,
                                gap: 0.5,
                                minWidth: "60px",
                            }}
                        >
                            {controlButtons.map((button, index) => (
                                <Box key={index}>
                                    {isButtonsExpanded
                                        ? (
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                    py: 1,
                                                    px: 1,
                                                    borderRadius: 2,
                                                    cursor: button.disabled
                                                        ? "default"
                                                        : "pointer",
                                                    transition:
                                                        "background-color 0.2s ease",
                                                    "&:hover": {
                                                        backgroundColor:
                                                            button.disabled
                                                                ? "transparent"
                                                                : "primary.light",
                                                        color: button.disabled
                                                            ? "inherit"
                                                            : "white",
                                                    },
                                                }}
                                                onClick={button.disabled
                                                    ? undefined
                                                    : button.onClick}
                                            >
                                                <IconButton
                                                    disabled={button.disabled}
                                                    sx={{
                                                        p: 0.5,
                                                        "&:hover": {
                                                            backgroundColor:
                                                                "transparent",
                                                        },
                                                    }}
                                                >
                                                    {button.icon}
                                                </IconButton>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontSize: "0.875rem",
                                                        fontWeight: 500,
                                                        textWrap: "nowrap",
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    {button.label}
                                                </Typography>
                                            </Box>
                                        )
                                        : (
                                            <Tooltip
                                                title={button.label}
                                                arrow
                                                placement="right"
                                            >
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "left",
                                                        gap: 1,
                                                        py: 0.5,
                                                        px: 1,
                                                        borderRadius: 2,
                                                        cursor: button.disabled
                                                            ? "default"
                                                            : "pointer",
                                                        transition:
                                                            "background-color 0.2s ease",
                                                        "&:hover": {
                                                            backgroundColor:
                                                                button.disabled
                                                                    ? "transparent"
                                                                    : "primary.light",
                                                            color:
                                                                button.disabled
                                                                    ? "inherit"
                                                                    : "white",
                                                        },
                                                    }}
                                                    onClick={button.disabled
                                                        ? undefined
                                                        : button.onClick}
                                                >
                                                    <IconButton
                                                        onClick={button.onClick}
                                                        disabled={button
                                                            .disabled}
                                                        sx={{
                                                            width: "100%",
                                                            "&:hover": {
                                                                backgroundColor:
                                                                    "primary.light",
                                                                color: "white",
                                                            },
                                                        }}
                                                    >
                                                        {button.icon}
                                                    </IconButton>
                                                </Box>
                                            </Tooltip>
                                        )}
                                </Box>
                            ))}
                        </Box>
                    </Paper>
                </ClickAwayListener>
            </Box>

            {/* Hidden file input for merge functionality */}
            <input
                ref={mergeFileInputRef}
                type="file"
                accept=".sqlite,.db,.sqlite3"
                onChange={handleFileSelect}
                style={{ display: "none" }}
            />
        </>
    );
};


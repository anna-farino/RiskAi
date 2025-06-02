export default {
    content: [
        "./src/**/*.{js,ts,jsx,tsx}",
        "./index.html",
    ],
    darkMode: ["class"],
    theme: {
        extend: {
            keyframes: {
                "caret-blink": {
                    "0%,70%,100%": { opacity: "1" },
                    "20%,50%": { opacity: "0" },
                },
            },
            animation: {
                "caret-blink": "caret-blink 1.25s ease-out infinite",
            },
            colors: {
                // System UI Colors (keep compatibility with shadcn)
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                },
                // RisqAi Custom Colors
                'risq': {
                    'purple': {
                        DEFAULT: "#BF00FF",
                        foreground: "#FFFFFF"
                    },
                    'purple-light': {
                        DEFAULT: "#D54AFF",
                        foreground: "#000000"
                    },
                    'purple-dark': {
                        DEFAULT: "#9700CC",
                        foreground: "#FFFFFF"
                    },
                    'blue': {
                        DEFAULT: "#1E3A8A",
                        foreground: "#FFFFFF"
                    },
                    'cyan': {
                        DEFAULT: "#00FFFF",
                        foreground: "#000000"
                    },
                    'magenta': {
                        DEFAULT: "#FF00BF",
                        foreground: "#FFFFFF"
                    },
                    'green': {
                        DEFAULT: "#00AA55",
                        foreground: "#FFFFFF"
                    },
                    'green-light': {
                        DEFAULT: "#33BB77",
                        foreground: "#000000"
                    },
                    'green-dark': {
                        DEFAULT: "#008040",
                        foreground: "#FFFFFF"
                    },
                    'orange': {
                        DEFAULT: "#FF5500",
                        foreground: "#FFFFFF"
                    },
                    'orange-light': {
                        DEFAULT: "#FF7733",
                        foreground: "#000000"
                    },
                    'orange-dark': {
                        DEFAULT: "#CC4400",
                        foreground: "#FFFFFF"
                    },
                    'gray': {
                        100: "#F5F5F5",
                        300: "#CCCCCC",
                        500: "#555555",
                        700: "#222222",
                    },
                    'success': "#00AA55",
                    'warning': "#FFBB00",
                    'error': "#FF3300"
                }
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            }
        }
    },
    plugins: [require("@tailwindcss/typography"), require("tailwindcss-animate")],
};

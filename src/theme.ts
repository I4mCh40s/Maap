// src/theme.ts

const COLORS = {
  // Base Colors
  black: '#121212', // A rich, off-black for backgrounds
  darkGrey: '#1E1E1E', // For card backgrounds
  mediumGrey: '#333333', // For borders or less important text
  lightGrey: '#888888', // For placeholder text or icons
  white: '#FFFFFF', // For primary text
  
  // Accent Colors (Let's go with a vibrant orange like the habit tracker)
  primary: '#FFA726', // A vibrant orange
  primary_light: '#FFB74D',

  text: '#000000', // Primary text color
  text_secondary: '#555555', // Secondary text color

  success: '#4CAF50', // Green for success messages
  
  // Semantic Colors
  danger: '#E53935',
};

const FONT_SIZES = {
  h1: 32,
  h2: 24,
  h3: 20,
  body: 16,
  caption: 12,
};

const FONT_FAMILIES = {
  // You can set up custom fonts later, for now we'll use system defaults
  regular: 'System',
  bold: 'System', // On iOS this will find the bold variant
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
};

const theme = {
  colors: COLORS,
  fontSizes: FONT_SIZES,
  fontFamilies: FONT_FAMILIES,
  spacing: SPACING,
};

export default theme;
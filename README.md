# Bridge SDK

A TypeScript library with Prettier formatting and comprehensive tooling.

## Features

- 🚀 TypeScript with strict configuration
- 💅 Prettier code formatting
- 🔍 ESLint linting with TypeScript support
- 🧪 Jest testing framework
- 📦 Ready for npm publishing
- 🛠️ Comprehensive build scripts

## Installation

```bash
npm install
```

## Development

### Available Scripts

- `npm run build` - Build the library
- `npm run dev` - Watch mode for development
- `npm run clean` - Clean build directory
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

### Project Structure

```
src/
├── index.ts          # Main entry point
├── types.ts          # TypeScript type definitions
├── utils.ts          # Utility functions
└── __tests__/        # Test files
    └── index.test.ts
```

## Usage

```typescript
import { greet, Calculator, debounce, generateId } from 'bridge-sdk';

// Use the greeting function
const message = greet('World'); // "Hello, World!"

// Use the calculator
const calc = new Calculator();
const result = calc.add(5, 3); // 8

// Use utility functions
const debouncedFn = debounce(() => console.log('Debounced!'), 1000);
const id = generateId(10); // Random 10-character string
```

## Configuration

### Prettier

The project uses Prettier for code formatting with the following configuration:

- Single quotes
- 2 spaces indentation
- 80 character line width
- Trailing commas in ES5 mode
- Semicolons enabled

### TypeScript

Strict TypeScript configuration with:

- ES2020 target
- CommonJS modules
- Declaration files generation
- Source maps enabled
- Strict type checking

### ESLint

ESLint configuration with:

- TypeScript support
- Prettier integration
- Recommended rules
- Custom rule overrides

## Testing

Tests are written using Jest and TypeScript. Run tests with:

```bash
npm test
```

## Building

Build the library for production:

```bash
npm run build
```

This will:
1. Clean the dist directory
2. Compile TypeScript to JavaScript
3. Generate declaration files
4. Create source maps

## Publishing

The library is configured for npm publishing with:

- Main entry point: `dist/index.js`
- TypeScript declarations: `dist/index.d.ts`
- Only `dist` directory included in package

## License

MIT 
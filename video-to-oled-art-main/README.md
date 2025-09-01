# Video to Arduino OLED Converter

Convert short videos into ready-to-use Arduino code for OLED displays. This web application processes video files and generates optimized Arduino sketches that can be directly copied and pasted into the Arduino IDE.

## Features

- **Video Processing**: Upload MP4, AVI, MOV, or MKV files
- **Multiple Display Sizes**: Support for 128x64, 96x64, 128x32, 64x48, and custom sizes
- **Multiple Libraries**: Adafruit GFX + SSD1306, Adafruit GFX + SSD1331, and U8g2
- **Real-time Preview**: See your video animation on a simulated OLED display
- **Automatic Code Generation**: Arduino code is automatically generated when video processing completes
- **Ready-to-Use Code**: Complete Arduino sketches with all frame data included

## How It Works

1. **Upload Video**: Select your video file (supports common formats)
2. **Configure Display**: Choose OLED size, orientation, and Arduino library
3. **Process Frames**: Video is converted to monochrome frames optimized for Arduino
4. **Preview Animation**: See how your video will look on the OLED display
5. **Copy Code**: Automatically generated Arduino code is ready to copy/paste

## Project info

**URL**: https://lovable.dev/projects/6ec4caee-ba31-43d8-9177-12fd39fa4316

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/6ec4caee-ba31-43d8-9177-12fd39fa4316) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/6ec4caee-ba31-43d8-9177-12fd39fa4316) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

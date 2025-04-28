# Livepeer Project for ElizaOS

This project demonstrates integrating a Livepeer inference plugin with ElizaOS.

## Setup and Usage

Follow these steps to set up and run the project:

1.  **Build ElizaOS from Source:** Follow the official ElizaOS quickstart guide to build the core system from source: [https://eliza.how/docs/quickstart](https://eliza.how/docs/quickstart)

2.  **Clone the Livepeer Plugin:** Navigate to the `packages` directory within your main ElizaOS checkout and clone the `plugin-livepeer-inference` repository:
    ```bash
    cd path/to/eliza/packages
    git clone https://github.com/UD1sto/plugin-livepeer-inference.git
    ```
    *Note: Renaming the directory to `plugin-livepeer-inference` during clone might be necessary if the project expects that specific name.*

3.  **Build the Livepeer Plugin:** Change into the plugin directory and build it:
    ```bash
    cd plugin-livepeer-inference
    bun run build
    ```

4.  **Clone this Project:** Go back to the root directory of your main ElizaOS checkout and clone this project repository:
    ```bash
    cd path/to/eliza # Go back to the root
    git clone https://github.com/UD1sto/elizav2-livepeer.git
    ```

5.  **Configure Environment:** Navigate into this project directory (`livepeer-project`), copy the example environment file, and fill in your details (especially the Livepeer API key and gateway URL):
    ```bash
    cd livepeer-project
    cp .example.env .env
    # Edit .env with your favorite editor
    ```

6.  **Build and Start the Project:** Build the project and start it using the ElizaOS CLI:
    ```bash
    bun install # Make sure dependencies are installed
    bun run build && elizaos start
    ```

7.  **Interact with the Agent:** Open your web browser and go to [http://localhost:3000](http://localhost:3000). You should now be able to chat with the Eliza agent, which will use the Livepeer plugin for inference if configured correctly in your `.env` file.

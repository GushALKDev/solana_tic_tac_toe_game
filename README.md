
# Solana Tic-Tac-Toe Game

A decentralized Tic-Tac-Toe game built on the Solana blockchain using Anchor. This project allows two players to compete in a classic game of Tic-Tac-Toe with verifiable moves and game state updates, all managed on-chain.

## Features

- **Decentralized**: The game is fully managed on-chain, with each move and game state stored on the Solana blockchain.
- **Secure Game State**: Each game has a unique account for storing the board, players, and game status, ensuring the integrity of every match.
- **Player Turns**: The program enforces player turns, preventing moves out of sequence.
- **Win and Tie Detection**: Automatically detects when a player has won or if the game ends in a tie.
- **Custom Error Handling**: Provides error messages for common gameplay issues like invalid moves or out-of-turn actions.
- **Multiple Games Support**: A global state allows tracking and managing multiple games simultaneously, each with a unique identifier.

## Game Setup

The game is designed to work with two players who both have public keys on the Solana blockchain. A unique Program Derived Address (PDA) is created for each game, ensuring each game session is separate.

## How to Play

1. **Initialize Global State**: This is only done once to set up the global counter for tracking games.

   ```typescript
   await program.methods
     .initializeGlobalState()
     .accounts({
       globalState: globalStateAddress,
       payer: playerOne.publicKey,
       systemProgram: anchor.web3.SystemProgram.programId,
     })
     .rpc();
   ```

2. **Setup a New Game**: Player 1 can initiate a game with Player 2. This step assigns players to the game and prepares the board.

   ```typescript
   await program.methods
     .setupGame(playerTwo.publicKey, playerTwo.publicKey)
     .accounts({
       globalState: globalStateAddress,
       playerOne: playerOne.publicKey,
       playerTwo: playerTwo.publicKey,
       systemProgram: anchor.web3.SystemProgram.programId,
     })
     .rpc();
   ```

3. **Start the Game**: This initializes the game’s state, preparing it for players to take turns.

   ```typescript
   await program.methods
     .startGame()
     .accounts({
       game: gameAddress,
     })
     .rpc();
   ```

4. **Take Turns**: Players alternate making moves by specifying the row and column coordinates they want to place their marker on.

   ```typescript
   await program.methods
     .play({ row: x, column: y }) // Replace x and y with the desired tile coordinates
     .accounts({
       player: currentPlayer.publicKey,
       game: gameAddress,
     })
     .rpc();
   ```

   - Player 1 begins with "X" and Player 2 follows with "O".
   - Each move updates the game state on-chain.
   - The game detects if a move completes a row, column, or diagonal, resulting in a win for the current player.
   - If all tiles are filled without a win, the game ends in a tie.

5. **Check Game Status**: The game state (`Active`, `Tie`, or `Won`) can be checked anytime to confirm the game's progress.

## Program Structure

- **GlobalState**: Tracks the total count of games played to ensure unique game accounts.
- **Game**: Stores the state of an individual game, including the board, players, and current turn.
- **GameState Enum**: Manages possible game outcomes (`Active`, `Tie`, or `Won`).
- **Tile Struct**: Defines the row and column for each move.
- **Error Handling**: Common errors include:
  - `GameAlreadyOver`: Attempt to play in a finished game.
  - `NotPlayersTurn`: Player attempted to play out of turn.
  - `TileAlreadySet`: Trying to play on an occupied tile.
  - `TileOutOfBounds`: Attempted move is outside the board limits.

## Running Tests

Tests are included to verify game mechanics, including scenarios where Player 1 wins and games that end in a tie. Each test initializes a game, simulates a series of moves, and checks the final board and game state.

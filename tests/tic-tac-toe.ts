import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TicTacToe } from "../target/types/tic_tac_toe";
import { expect } from 'chai';

describe("tic-tac-toe", () => {
  // Sets up the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TicTacToe as Program<TicTacToe>;
  let globalStateAddress;

  // Initialize global state before each test
  let playerOne, playerTwo;

  before(async () => {
    playerOne = (program.provider as anchor.AnchorProvider).wallet; // Player one
    playerTwo = anchor.web3.Keypair.generate(); // Player two

    [globalStateAddress] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("global_state")],
      program.programId
    );

    console.log("globalState Address:", globalStateAddress.toString());
    console.log("Player 1 Address:", playerOne.publicKey.toString());
    console.log("Player 2 Address:", playerTwo.publicKey.toString());

    // Calls a method to create and initialize the global state
    try {
      await program.account.globalState.fetch(globalStateAddress);
      console.log("Global state already exists, skipping initialization");
    } catch (e) {
      console.log("Global state does not exist, initializing");
      await program.methods.initializeGlobalState()
        .accounts({
          globalState: globalStateAddress,
          payer: playerOne.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    }
  });

  // Test to set up a game
  it('setup game!', async () => {
    // Calculate the PDA for the game account using the appropriate seeds
    const [globalStateAddress] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("global_state")],
      program.programId
    );

    // Fetch global account
    const globalStatePDA = await program.account.globalState.fetch(globalStateAddress);

    const gameCount = globalStatePDA.gameCount.toString();

    const [gameAddress] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("game"),
        playerOne.publicKey.toBuffer(),
        playerTwo.publicKey.toBuffer(),
        Buffer.from(globalStatePDA.gameCount.toArray('le', 8)),
      ],
      program.programId
    );

    console.log("Program ID:", program.programId.toString());
    console.log("Global State Address:", globalStateAddress.toString());
    console.log("Global Game Count:", gameCount);
    console.log("Player One Address:", playerOne.publicKey.toString());
    console.log("Player Two Address:", playerTwo.publicKey.toString());
    console.log("Game Address:", gameAddress.toString());

    // Call the game setup method
    await program.methods
      .setupGame(playerOne.publicKey, playerTwo.publicKey)
      .accounts({
        globalState: globalStateAddress, // Ensure to pass the global account
        playerOne: playerOne.publicKey,
        playerTwo: playerTwo.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Fetch game state from the game account
    let gamePDA = await program.account.game.fetch(gameAddress);

    // Verify that the turn is correctly initialized
    expect(gamePDA.turn).to.equal(1); // Initial turn should be 1 since the game was setup.
    // Verify that players are set up correctly
    expect(gamePDA.players).to.eql([playerOne.publicKey, playerTwo.publicKey]);
    // Verify that the game state is inactive
    expect(gamePDA.state).to.eql({ active: {} });
    // Verify that the board is empty
    expect(gamePDA.board).to.eql([
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ]);
  });

  // Test to simulate a win by player one
  it('player one wins', async () => {
    const globalState = await program.account.globalState.fetch(globalStateAddress);

    if (!globalState || globalState.gameCount === undefined) {
      console.error("gameCount is undefined in globalState:", globalState);
      throw new Error("Game count is undefined");
    }
    
    const [gameAddress] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("game"),
        playerOne.publicKey.toBuffer(),
        playerTwo.publicKey.toBuffer(),
        Buffer.from(globalState.gameCount.toArray('le', 8)),
      ],
      program.programId
    );

    // Call the game setup method
    await program.methods
      .setupGame(playerTwo.publicKey, playerTwo.publicKey)
      .accounts({
        globalState: globalStateAddress, // Ensure to pass the global account
        playerOne: playerOne.publicKey,
        playerTwo: playerTwo.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Initialize the game
    await program.methods
      .startGame()
      .accounts({
        game: gameAddress,
      })
      .rpc();

    // Sequence of moves for player one to win:
    await play(program, gameAddress, playerOne, { row: 0, column: 0 }, 2, { active: {} }, [
      [{ x: {} }, null, null],
      [null, null, null],
      [null, null, null],
    ]);

    await play(program, gameAddress, playerTwo, { row: 1, column: 0 }, 3, { active: {} }, [
      [{ x: {} }, null, null],
      [{ o: {} }, null, null],
      [null, null, null],
    ]);

    await play(program, gameAddress, playerOne, { row: 0, column: 1 }, 4, { active: {} }, [
      [{ x: {} }, { x: {} }, null],
      [{ o: {} }, null, null],
      [null, null, null],
    ]);

    await play(program, gameAddress, playerTwo, { row: 1, column: 1 }, 5, { active: {} }, [
      [{ x: {} }, { x: {} }, null],
      [{ o: {} }, { o: {} }, null],
      [null, null, null],
    ]);

    // Final move for player one to win
    await play(program, gameAddress, playerOne, { row: 0, column: 2 }, 6, { won: { winner: playerOne.publicKey } }, [
      [{ x: {} }, { x: {} }, { x: {} }],
      [{ o: {} }, { o: {} }, null],
      [null, null, null],
    ]);
  });


  // Test to simulate a tie game
  it('game ends in a tie', async () => {
    const globalState = await program.account.globalState.fetch(globalStateAddress);

    if (!globalState || globalState.gameCount === undefined) {
      console.error("gameCount is undefined in globalState:", globalState);
      throw new Error("Game count is undefined");
    }
    
    const [gameAddress] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("game"),
        playerOne.publicKey.toBuffer(),
        playerTwo.publicKey.toBuffer(),
        Buffer.from(globalState.gameCount.toArray('le', 8)),
      ],
      program.programId
    );

    // Call the game setup method
    await program.methods
      .setupGame(playerTwo.publicKey, playerTwo.publicKey)
      .accounts({
        globalState: globalStateAddress, // Ensure to pass the global account
        playerOne: playerOne.publicKey,
        playerTwo: playerTwo.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Initialize the game
    await program.methods
      .startGame()
      .accounts({
        game: gameAddress,
      })
      .rpc();

    // Sequence of moves to result in a tie:
    await play(program, gameAddress, playerOne, { row: 0, column: 0 }, 2, { active: {} }, [
      [{ x: {} }, null, null],
      [null, null, null],
      [null, null, null],
    ]);

    await play(program, gameAddress, playerTwo, { row: 0, column: 1 }, 3, { active: {} }, [
      [{ x: {} }, { o: {} }, null],
      [null, null, null],
      [null, null, null],
    ]);

    await play(program, gameAddress, playerOne, { row: 0, column: 2 }, 4, { active: {} }, [
      [{ x: {} }, { o: {} }, { x: {} }],
      [null, null, null],
      [null, null, null],
    ]);

    await play(program, gameAddress, playerTwo, { row: 1, column: 1 }, 5, { active: {} }, [
      [{ x: {} }, { o: {} }, { x: {} }],
      [null, { o: {} }, null],
      [null, null, null],
    ]);

    await play(program, gameAddress, playerOne, { row: 1, column: 0 }, 6, { active: {} }, [
      [{ x: {} }, { o: {} }, { x: {} }],
      [{ x: {} }, { o: {} }, null],
      [null, null, null],
    ]);

    await play(program, gameAddress, playerTwo, { row: 1, column: 2 }, 7, { active: {} }, [
      [{ x: {} }, { o: {} }, { x: {} }],
      [{ x: {} }, { o: {} }, { o: {} }],
      [null, null, null],
    ]);

    await play(program, gameAddress, playerOne, { row: 2, column: 1 }, 8, { active: {} }, [
      [{ x: {} }, { o: {} }, { x: {} }],
      [{ x: {} }, { o: {} }, { o: {} }],
      [null, { x: {} }, null],
    ]);

    await play(program, gameAddress, playerTwo, { row: 2, column: 0 }, 9, { active: {} }, [
      [{ x: {} }, { o: {} }, { x: {} }],
      [{ x: {} }, { o: {} }, { o: {} }],
      [{ o: {} }, { x: {} }, null],
    ]);

    // Final move that fills the board and results in a tie
    await play(program, gameAddress, playerOne, { row: 2, column: 2 }, 10, { tie: {} }, [
      [{ x: {} }, { o: {} }, { x: {} }],
      [{ x: {} }, { o: {} }, { o: {} }],
      [{ o: {} }, { x: {} }, { x: {} }],
    ]);
  });

  // Test to check error when playing on an occupied tile
  it('throws error when tile is already occupied', async () => {
    const globalState = await program.account.globalState.fetch(globalStateAddress);

    if (!globalState || globalState.gameCount === undefined) {
      console.error("gameCount is undefined in globalState:", globalState);
      throw new Error("Game count is undefined");
    }
    
    const [gameAddress] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("game"),
        playerOne.publicKey.toBuffer(),
        playerTwo.publicKey.toBuffer(),
        Buffer.from(globalState.gameCount.toArray('le', 8)),
      ],
      program.programId
    );

    // Call the game setup method
    await program.methods
      .setupGame(playerTwo.publicKey, playerTwo.publicKey)
      .accounts({
        globalState: globalStateAddress,
        playerOne: playerOne.publicKey,
        playerTwo: playerTwo.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Initialize the game
    await program.methods
      .startGame()
      .accounts({
        game: gameAddress,
      })
      .rpc();

    // Player 1 plays at tile (0, 0)
    await play(program, gameAddress, playerOne, { row: 0, column: 0 }, 2, { active: {} }, [
      [{ x: {} }, null, null],
      [null, null, null],
      [null, null, null],
    ]);

    // Player 2 tries to play on the same tile (0, 0), should throw an error
    try {
      await play(program, gameAddress, playerTwo, { row: 0, column: 0 }, 2, { active: {} }, [
        [{ x: {} }, null, null],
        [null, null, null],
        [null, null, null],
      ]);
      throw new Error("Expected an error but did not get one"); // Forces the test to fail if no error is thrown
    }
    catch (error: any) {
      expect(error.message).to.contain("TileAlreadySet"); // Check that the error message contains the expected text
      // console.log("Error:", error.message);
    }
  });

  // Test to check error when playing outside the board boundaries
  it('throws error when tile is out of bounds', async () => {
    const globalState = await program.account.globalState.fetch(globalStateAddress);

    if (!globalState || globalState.gameCount === undefined) {
      console.error("gameCount is undefined in globalState:", globalState);
      throw new Error("Game count is undefined");
    }
    
    const [gameAddress] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("game"),
        playerOne.publicKey.toBuffer(),
        playerTwo.publicKey.toBuffer(),
        Buffer.from(globalState.gameCount.toArray('le', 8)),
      ],
      program.programId
    );

    // Call the game setup method
    await program.methods
      .setupGame(playerTwo.publicKey, playerTwo.publicKey)
      .accounts({
        globalState: globalStateAddress,
        playerOne: playerOne.publicKey,
        playerTwo: playerTwo.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Initialize the game
    await program.methods
      .startGame()
      .accounts({
        game: gameAddress,
      })
      .rpc();

    // Player 1 attempts to play outside of the board boundaries at (3, 3), should throw an error
    try {
      await play(program, gameAddress, playerOne, { row: 3, column: 3 }, 1, { active: {} }, [
        [{ x: {} }, null, null],
        [null, null, null],
        [null, null, null],
      ]);
      throw new Error("Expected an error but did not get one"); // Forces the test to fail if no error is thrown
    }
    catch (error: any) {
      expect(error.message).to.contain("TileOutOfBounds"); // Check that the error message contains the expected text
      // console.log("Error:", error.message);
    }
  });
});

// Helper function to simulate a move
async function play(
  program: Program<TicTacToe>,
  game,
  player,
  tile,
  expectedTurn,
  expectedGameState,
  expectedBoard
) {
  // Make the move
  await program.methods
    .play(tile)
    .accounts({
      player: player.publicKey,
      game,
    })
    .signers(player instanceof (anchor.Wallet as any) ? [] : [player])
    .rpc();

  // Verify game state after the move
  const gameState = await program.account.game.fetch(game);
  
  if (expectedTurn > gameState.turn) {
    // Player won
    if (gameState.state.won != undefined ) {
      expect(gameState.state.won).not.to.eql(undefined);
    }
    // Tie
    else if (gameState.state.tie != undefined ) {
      expect(gameState.state.tie).not.to.eql(undefined);
    }
  }
  else {
    // Turn must be equal as expected
    expect(gameState.turn).to.equal(expectedTurn);
  }
  expect(gameState.state).to.eql(expectedGameState);
  expect(gameState.board).to.eql(expectedBoard);
  // console.log("State",gameState.state);
}

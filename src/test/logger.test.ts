import { Logger } from '../logger';


jest.mock('vscode');

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = Logger.getInstance();
  });

  test('log method should call console.log', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    logger.log('Test message', 'INFO');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Test message'));
  });
});
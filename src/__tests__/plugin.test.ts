import ServerlessPlugin from '../index';

const serverless: any = {
  getProvider: () => ({}),
};
const options: any = {};

describe('Serverless Plugin Platform Apps', () => {
  test('Should meet Serverless Plugin Interface', () => {
    const plugin = new ServerlessPlugin(serverless, options);
    expect(plugin.hooks).toEqual({
      'after:info:info': expect.any(Function),
      'before:deploy:deploy': expect.any(Function),
      'deploy:additionalStacks:deploy': expect.any(Function),
      'remove:additionalStacks:remove': expect.any(Function),
    });
  });
});

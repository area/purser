import EthereumTx from 'ethereumjs-tx';

import {
  transactionObjectValidator,
  userInputValidator,
} from '../../../core/helpers';
import * as utils from '../../../core/utils';

import { signTransaction } from '../../../trezor/staticMethods';
import { payloadListener } from '../../../trezor/helpers';
import {
  derivationPathNormalizer,
  multipleOfTwoHexValueNormalizer,
  addressNormalizer,
  hexSequenceNormalizer,
} from '../../../core/normalizers';
import { derivationPathValidator } from '../../../core/validators';

import { PAYLOAD_SIGNTX } from '../../../trezor/payloads';
import { REQUIRED_PROPS } from '../../../core/defaults';
import { STD_ERRORS } from '../../../trezor/defaults';

jest.dontMock('../../../trezor/staticMethods');

jest.mock('ethereumjs-tx');
jest.mock('../../../core/validators');
jest.mock('../../../core/normalizers');
jest.mock('../../../core/utils');
jest.mock('../../../core/helpers');
/*
 * Manual mocking a manual mock. Yay for Jest being built by Facebook!
 *
 * If you need context, see this:
 * https://github.com/facebook/jest/issues/2070
 */
jest.mock('../../../trezor/helpers', () =>
  /* eslint-disable-next-line global-require */
  require('../../../trezor/__remocks__/helpers'),
);

/*
 * These values are not correct. Do not use the as reference.
 * If the validators wouldn't be mocked, they wouldn't pass.
 */
const derivationPath = 'mocked-derivation-path';
const chainId = 'mocked-chain-id';
const inputData = 'mocked-data';
const gasLimit = 'mocked-gas-limit';
const gasPrice = 'mocked-gas-price';
const nonce = 'mocked-nonce';
const to = 'mocked-destination-address';
const value = 'mocked-transaction-value';
const mockedTransactionObject = {
  gasPrice,
  gasLimit,
  chainId,
  nonce,
  to,
  value,
  inputData,
};
const mockedArgumentsObject = {
  ...mockedTransactionObject,
  derivationPath,
};

describe('`Trezor` Hardware Wallet Module Static Methods', () => {
  afterEach(() => {
    EthereumTx.mockClear();
  });
  describe('`signTransaction()` static method', () => {
    test('Uses the correct trezor service payload type', async () => {
      const { type, requiredFirmware } = PAYLOAD_SIGNTX;
      await signTransaction(mockedArgumentsObject);
      expect(payloadListener).toHaveBeenCalled();
      expect(payloadListener).toHaveBeenCalledWith({
        /*
        * We only care about what payload type this method sends
        */
        payload: expect.objectContaining({
          type,
          requiredFirmware,
        }),
      });
    });
    test('Validates the transaction input values', async () => {
      await signTransaction(mockedArgumentsObject);
      /*
       * Calls the validation helper with the correct values
       */
      expect(transactionObjectValidator).toHaveBeenCalled();
      expect(transactionObjectValidator).toHaveBeenCalledWith(
        mockedTransactionObject,
      );
    });
    test('Validates the derivation path individually', async () => {
      await signTransaction(mockedArgumentsObject);
      /*
       * Calls the validation helper with the correct values
       */
      expect(derivationPathValidator).toHaveBeenCalled();
      expect(derivationPathValidator).toHaveBeenCalledWith(derivationPath);
      /*
       * So it throws if you don't provide one
       */
      expect(signTransaction()).rejects.toThrow();
    });
    test('Normalizes the transaction input values', async () => {
      await signTransaction(mockedArgumentsObject);
      /*
       * Normalizes the derivation path
       */
      expect(derivationPathNormalizer).toHaveBeenCalled();
      expect(derivationPathNormalizer).toHaveBeenCalledWith(derivationPath);
      /*
       * Normalizes gas price and gas limit
       */
      expect(multipleOfTwoHexValueNormalizer).toHaveBeenCalled();
      expect(multipleOfTwoHexValueNormalizer).toHaveBeenCalledWith(gasPrice);
      expect(multipleOfTwoHexValueNormalizer).toHaveBeenCalledWith(gasLimit);
      /*
       * Normalizes the nonce
       */
      expect(multipleOfTwoHexValueNormalizer).toHaveBeenCalled();
      expect(multipleOfTwoHexValueNormalizer).toHaveBeenCalledWith(nonce);
      /*
       * Normalizes the destination address
       */
      expect(addressNormalizer).toHaveBeenCalled();
      expect(addressNormalizer).toHaveBeenCalledWith(to, false);
      /*
       * Normalizes the transaction value
       */
      expect(multipleOfTwoHexValueNormalizer).toHaveBeenCalled();
      expect(multipleOfTwoHexValueNormalizer).toHaveBeenCalledWith(value);
      /*
       * Normalizes the transaction input data
       */
      expect(hexSequenceNormalizer).toHaveBeenCalled();
      expect(hexSequenceNormalizer).toHaveBeenCalledWith(inputData, false);
    });
    test('Converts R,S,V ECDSA into a hex signature', async () => {
      const rComponent = 'mocked-r-signature-component';
      const sComponent = 'mocked-s-signature-component';
      const recoveryParam = 'mocked-recovery param';
      /*
       * We're re-mocking the helpers just for this test so we can simulate
       * a different response
       */
      payloadListener.mockImplementation(() => ({
        r: rComponent,
        s: sComponent,
        v: recoveryParam,
      }));
      await signTransaction(mockedArgumentsObject);
      expect(EthereumTx).toHaveBeenCalled();
      expect(EthereumTx).toHaveBeenCalledWith({
        r: rComponent,
        s: sComponent,
        v: recoveryParam,
      });
    });
    test('Catches is something goes wrong along the way', async () => {
      /*
       * We're re-mocking the helpers just for this test so we can simulate
       * an error from one of the method
       */
      payloadListener.mockImplementation(() =>
        Promise.reject(new Error('Oh no!')),
      );
      expect(signTransaction(mockedArgumentsObject)).rejects.toThrow();
    });
    test('Log a warning if the user Cancels signing it', async () => {
      /*
       * We're re-mocking the helpers just for this test so we can simulate
       * a cancel response.
       */
      payloadListener.mockImplementation(() =>
        Promise.reject(new Error(STD_ERRORS.CANCEL_TX_SIGN)),
      );
      await signTransaction(mockedArgumentsObject);
      expect(EthereumTx).not.toHaveBeenCalled();
      /*
       * User cancelled, so we don't throw
       */
      expect(utils.warning).toHaveBeenCalled();
    });
    test("Validate the user's input", async () => {
      await signTransaction(mockedArgumentsObject);
      expect(userInputValidator).toHaveBeenCalled();
      expect(userInputValidator).toHaveBeenCalledWith({
        argumentsAccess: [mockedTransactionObject],
        requiredEither: REQUIRED_PROPS.SIGN_TRANSACTION,
      });
    });
  });
});
